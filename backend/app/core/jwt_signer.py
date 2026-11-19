"""Local JWT signing and verification for Brightway Computer Academy Portal."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt

from app.config import Settings

ACCESS_TOKEN_TTL_SECONDS = 86400 * 7  # 7 days
_ISSUER = "brightway-portal"


def _secret(settings: Settings) -> str:
    raw = settings.supabase_jwt_secret.get_secret_value()
    if raw and len(raw) >= 16:
        return raw
    return "brightway-computer-academy-jwt-signing-secret-2026"


def create_access_token(
    settings: Settings,
    *,
    user_id: UUID,
    role: str,
    identifier: str,
    ttl_seconds: int = ACCESS_TOKEN_TTL_SECONDS,
) -> str:
    now = datetime.now(tz=UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "identifier": identifier,
        "iss": _ISSUER,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, _secret(settings), algorithm="HS256")


def decode_local_token(settings: Settings, token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(
            token,
            _secret(settings),
            algorithms=["HS256"],
            issuer=_ISSUER,
            audience=settings.jwt_audience,
            options={"require": ["sub", "exp", "role"]},
        )
    except jwt.PyJWTError:
        return None
