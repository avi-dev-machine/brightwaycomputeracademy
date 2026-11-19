from uuid import UUID

from pydantic import BaseModel, Field

from app.core.constants import Role


class LoginRequest(BaseModel):
    identifier: str | None = Field(
        default=None,
        max_length=254,
        description="Student ID (e.g. RG240017) or Admin Username (e.g. BWADMIN)",
    )
    student_id: str | None = Field(default=None, max_length=254)
    username: str | None = Field(default=None, max_length=254)
    email: str | None = Field(default=None, max_length=254)
    password: str | None = Field(
        default=None,
        max_length=128,
        description="Passcode, contact number, or admin password",
    )
    contact_number: str | None = Field(default=None, max_length=64)

    @property
    def login_id(self) -> str:
        val = (
            self.identifier
            or self.student_id
            or self.username
            or self.email
            or ""
        ).strip()
        if not val:
            raise ValueError("Student ID or Admin Username is required.")
        return val

    @property
    def secret(self) -> str:
        val = (self.password or self.contact_number or "").strip()
        if not val:
            raise ValueError("Passcode / Contact Number / Password is required.")
        return val


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=4096)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class MeOut(BaseModel):
    user_id: UUID
    email: str | None = None
    role: Role
    student_id: UUID | None = None
    student_code: str | None = None
    teacher_id: UUID | None = None
    display_name: str | None = None
    contact_number: str | None = None
    course: str | None = None
    batch: str | None = None
    monthly_fee: float | None = None
    fee_status: str | None = None
    month: str | None = None
    photo_url: str | None = None


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int
    user_id: UUID
    user: MeOut | None = None
