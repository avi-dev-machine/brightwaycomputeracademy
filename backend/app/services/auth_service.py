"""Authentication service for the strict 3-collection MongoDB Atlas schema (`admins` and `students`).

Supports:
1. Admin Login via `username` (e.g. `BWADMIN`) + bcrypt `password_hash` (`role = SUPER_ADMIN`).
2. Student Login via `student_id` (e.g. `RG240017`) + stored `password` (or derived passcode / registered `contact_number`).
"""

import re
from typing import Any
from uuid import UUID

from pymongo.database import Database as MongoDatabase

from app.config import Settings
from app.core.constants import Role, get_active_month
from app.core.errors import AuthenticationError, ValidationError
from app.core.jwt_signer import (
    ACCESS_TOKEN_TTL_SECONDS,
    create_access_token,
    decode_local_token,
)
from app.core.passwords import (
    hash_password,
    verify_password,
    verify_student_credential,
)
from app.core.security import CurrentUser
from app.schemas.auth import MeOut, TokenOut

ADMIN_EMAIL_ALIASES = {"admin@brightway.local": "BWADMIN"}


class AuthService:
    def __init__(
        self, conn: MongoDatabase[dict[str, Any]], settings: Settings
    ) -> None:
        self._db = conn
        self._settings = settings

    def login(self, identifier: str, password: str) -> TokenOut:
        clean_id = identifier.strip()
        if not clean_id or not password:
            raise AuthenticationError(
                "Student ID / Username and password are required."
            )

        alias_id = ADMIN_EMAIL_ALIASES.get(clean_id.lower(), clean_id)

        # 1. Check `admins` collection first
        admin_row = self._db["admins"].find_one(
            {"username": {"$regex": f"^{re.escape(alias_id)}$", "$options": "i"}}
        )

        if admin_row is not None:
            if not verify_password(password, admin_row["password_hash"]):
                raise AuthenticationError("Invalid administrator credentials.")

            role = Role(admin_row["role"])
            admin_uuid = UUID(str(admin_row["id"]))
            access_token = create_access_token(
                self._settings,
                user_id=admin_uuid,
                role=role.value,
                identifier=admin_row["username"],
            )
            me = MeOut(
                user_id=admin_uuid,
                email=None,
                role=role,
                student_id=None,
                student_code=None,
                display_name="Brightway Super Admin",
                month=get_active_month(),
            )
            return TokenOut(
                access_token=access_token,
                refresh_token=access_token,
                token_type="bearer",  # noqa: S106
                expires_in=ACCESS_TOKEN_TTL_SECONDS,
                user_id=admin_uuid,
                user=me,
            )

        # 2. Check `students` collection by `student_id`
        student_row = self._db["students"].find_one(
            {"student_id": clean_id.upper()}
        ) or self._db["students"].find_one(
            {"student_id": {"$regex": f"^{re.escape(clean_id)}$", "$options": "i"}}
        )

        if student_row is None or not student_row.get("student_id"):
            raise AuthenticationError(
                "Invalid Student ID or credentials. Please check your Student ID and Password."
            )

        if not verify_student_credential(
            name=student_row["name"],
            student_id=student_row["student_id"],
            contact_number=student_row.get("contact_number", ""),
            supplied_secret=password,
            stored_password=student_row.get("password"),
        ):
            raise AuthenticationError(
                "Invalid Password or Contact Number for this Student ID."
            )

        student_uuid = UUID(str(student_row["id"]))
        active_month = get_active_month()
        course = student_row.get("course") or student_row.get("batch") or "GENERAL"

        # Check active month payment status
        fp = self._db["fee_payments"].find_one(
            {
                "$or": [
                    {"student_key": str(student_uuid), "month_year": active_month},
                    {"student_id": student_row["student_id"], "month_year": active_month},
                ]
            }
        )
        fee_status = "PAID" if (fp and fp.get("status") == "PAID") else "UNPAID"

        access_token = create_access_token(
            self._settings,
            user_id=student_uuid,
            role=Role.STUDENT.value,
            identifier=student_row["student_id"],
        )
        me = MeOut(
            user_id=student_uuid,
            email=None,
            role=Role.STUDENT,
            student_id=student_uuid,
            student_code=student_row["student_id"],
            display_name=student_row["name"],
            contact_number=student_row.get("contact_number", ""),
            course=course,
            batch=course,
            monthly_fee=float(student_row.get("monthly_fee", 600)),
            fee_status=fee_status,
            month=active_month,
            photo_url=student_row.get("photo_url"),
        )
        return TokenOut(
            access_token=access_token,
            refresh_token=access_token,
            token_type="bearer",  # noqa: S106
            expires_in=ACCESS_TOKEN_TTL_SECONDS,
            user_id=student_uuid,
            user=me,
        )

    def refresh(self, refresh_token: str) -> TokenOut:
        claims = decode_local_token(self._settings, refresh_token)
        if not claims:
            raise AuthenticationError("Session expired. Please sign in again.")

        role_str = str(claims.get("role", Role.STUDENT.value))
        identifier = str(claims.get("identifier", ""))

        if role_str in (Role.SUPER_ADMIN.value, Role.ADMIN.value):
            admin_row = self._db["admins"].find_one(
                {"username": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}}
            )
            if not admin_row:
                raise AuthenticationError("Administrator session is no longer valid.")
            admin_uuid = UUID(str(admin_row["id"]))
            new_token = create_access_token(
                self._settings,
                user_id=admin_uuid,
                role=admin_row["role"],
                identifier=admin_row["username"],
            )
            return TokenOut(
                access_token=new_token,
                refresh_token=new_token,
                token_type="bearer",  # noqa: S106
                expires_in=ACCESS_TOKEN_TTL_SECONDS,
                user_id=admin_uuid,
            )

        student_row = self._db["students"].find_one(
            {"student_id": identifier.strip().upper()}
        )
        if not student_row:
            raise AuthenticationError("Student session is no longer valid.")

        student_uuid = UUID(str(student_row["id"]))
        new_token = create_access_token(
            self._settings,
            user_id=student_uuid,
            role=Role.STUDENT.value,
            identifier=student_row["student_id"],
        )
        return TokenOut(
            access_token=new_token,
            refresh_token=new_token,
            token_type="bearer",  # noqa: S106
            expires_in=ACCESS_TOKEN_TTL_SECONDS,
            user_id=student_uuid,
        )

    def me(self, user: CurrentUser) -> MeOut:
        active_month = get_active_month()
        if user.is_admin:
            return MeOut(
                user_id=user.id,
                email=None,
                role=user.role,
                student_id=None,
                student_code=user.identifier,
                display_name=user.full_name or "Brightway Super Admin",
                month=active_month,
            )

        row = self._db["students"].find_one({"id": str(user.id)})
        if not row and user.student_id:
            row = self._db["students"].find_one({"student_id": user.student_id.upper()})
        if not row:
            return MeOut(
                user_id=user.id,
                email=None,
                role=user.role,
                student_id=user.id,
                student_code=user.student_id,
                display_name=user.full_name,
                contact_number=user.phone,
                month=active_month,
            )

        student_uuid = UUID(str(row["id"]))
        course = row.get("course") or row.get("batch") or "GENERAL"
        fp = self._db["fee_payments"].find_one(
            {
                "$or": [
                    {"student_key": str(student_uuid), "month_year": active_month},
                    {"student_id": row.get("student_id"), "month_year": active_month},
                ]
            }
        )
        fee_status = "PAID" if (fp and fp.get("status") == "PAID") else "UNPAID"

        return MeOut(
            user_id=student_uuid,
            email=None,
            role=Role.STUDENT,
            student_id=student_uuid,
            student_code=row.get("student_id"),
            display_name=row["name"],
            contact_number=row.get("contact_number", ""),
            course=course,
            batch=course,
            monthly_fee=float(row.get("monthly_fee", 600)),
            fee_status=fee_status,
            month=active_month,
            photo_url=row.get("photo_url"),
        )

    def change_admin_password(
        self, user: CurrentUser, current_password: str, new_password: str
    ) -> dict[str, bool]:
        if not user.is_admin:
            raise ValidationError("Only administrators can change their password.")
        admin_row = self._db["admins"].find_one({"id": str(user.id)})
        if not admin_row or not verify_password(
            current_password, admin_row["password_hash"]
        ):
            raise AuthenticationError("Current administrator password is incorrect.")
        new_hash = hash_password(new_password)
        self._db["admins"].update_one(
            {"id": str(user.id)}, {"$set": {"password_hash": new_hash}}
        )
        return {"changed": True}
