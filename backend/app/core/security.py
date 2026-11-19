"""JWT verification and CurrentUser dependency for the strict 3-collection MongoDB Atlas schema (`students`, `admins`, `fee_payments`)."""

import re
from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import Settings, get_settings
from app.core.constants import Role
from app.core.errors import AuthenticationError, AuthorizationError
from app.core.jwt_signer import decode_local_token
from app.db.client import DbConn

_bearer = HTTPBearer(auto_error=False)
_jwks_clients: dict[str, PyJWKClient] = {}


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    role: Role
    email: str | None = None
    phone: str | None = None
    full_name: str | None = None
    identifier: str | None = None
    student_id: str | None = None
    must_change_password: bool = False

    @property
    def is_admin(self) -> bool:
        return self.role in (Role.SUPER_ADMIN, Role.ADMIN)


def _extract_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str:
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials:
        return credentials.credentials
    cookie_token = request.cookies.get("bw_access_token")
    if cookie_token:
        return cookie_token
    raise AuthenticationError("Missing authentication token.")


def verify_jwt(token: str, settings: Settings) -> dict:
    """Decode and validate a local Brightway JWT (or external JWKS/HS256 token)."""
    local_claims = decode_local_token(settings, token)
    if local_claims is not None:
        return local_claims

    jwks_url = settings.supabase_jwks_url
    secret = settings.supabase_jwt_secret.get_secret_value()

    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Malformed authentication token.") from exc

    alg = header.get("alg", "")
    try:
        if alg in ("RS256", "ES256") and jwks_url:
            client = _jwks_clients.get(jwks_url)
            if client is None:
                client = PyJWKClient(jwks_url, cache_keys=True)
                _jwks_clients[jwks_url] = client
            signing_key = client.get_signing_key_from_jwt(token).key
            return jwt.decode(
                token,
                signing_key,
                algorithms=[alg],
                audience=settings.jwt_audience,
                options={"require": ["sub", "exp"]},
            )
        if alg == "HS256" and secret:
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience=settings.jwt_audience,
                options={"require": ["sub", "exp"]},
            )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Authentication token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Invalid authentication token.") from exc

    raise AuthenticationError("Invalid or expired authentication token.")


def get_current_user(
    request: Request,
    conn: DbConn,
    settings: Annotated[Settings, Depends(get_settings)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
) -> CurrentUser:
    token = _extract_token(request, credentials)
    claims = verify_jwt(token, settings)

    try:
        sub_id = UUID(str(claims["sub"]))
    except (KeyError, ValueError) as exc:
        raise AuthenticationError("Token subject is not a valid UUID.") from exc

    sub_str = str(sub_id)
    raw_role = str(claims.get("role", "")).upper()
    identifier = str(claims.get("identifier", ""))

    # Resolve Admin from `admins` collection
    if raw_role in (Role.SUPER_ADMIN.value, Role.ADMIN.value):
        row = conn["admins"].find_one({"id": sub_str})
        if not row and identifier:
            row = conn["admins"].find_one(
                {"username": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}}
            )
        if not row:
            raise AuthorizationError("Administrator account not found or revoked.")
        return CurrentUser(
            id=UUID(str(row["id"])),
            role=Role(row["role"]),
            email=None,
            phone=None,
            full_name="Brightway Super Admin",
            identifier=row["username"],
            student_id=None,
            must_change_password=False,
        )

    # Resolve Student from `students` collection
    if raw_role == Role.STUDENT.value:
        row = conn["students"].find_one({"id": sub_str})
        if not row and identifier:
            row = conn["students"].find_one({"student_id": identifier.strip().upper()})
        if not row:
            raise AuthorizationError("Student profile not found.")
        return CurrentUser(
            id=UUID(str(row["id"])),
            role=Role.STUDENT,
            email=None,
            phone=row["contact_number"],
            full_name=row["name"],
            identifier=row["student_id"],
            student_id=row["student_id"],
            must_change_password=False,
        )

    # Fallback lookup across admins then students
    admin_row = conn["admins"].find_one({"id": sub_str})
    if admin_row:
        return CurrentUser(
            id=UUID(str(admin_row["id"])),
            role=Role(admin_row["role"]),
            full_name="Brightway Super Admin",
            identifier=admin_row["username"],
        )

    student_row = conn["students"].find_one({"id": sub_str})
    if student_row:
        return CurrentUser(
            id=UUID(str(student_row["id"])),
            role=Role.STUDENT,
            phone=student_row["contact_number"],
            full_name=student_row["name"],
            identifier=student_row["student_id"],
            student_id=student_row["student_id"],
        )

    raise AuthorizationError("User account not found.")


AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]
