"""Three-Level Role-Based Access Control (RBAC): SUPER_ADMIN, ADMIN, and STUDENT."""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.core.constants import Role
from app.core.errors import AuthorizationError
from app.core.security import AuthenticatedUser, CurrentUser


def require_strict_roles(*allowed: Role) -> Callable[[CurrentUser], CurrentUser]:
    allowed_set = set(allowed)

    def _check(user: AuthenticatedUser) -> CurrentUser:
        if user.role not in allowed_set:
            raise AuthorizationError(
                f"Access denied: role '{user.role.value}' is not permitted for this section.",
                details={"required_roles": sorted(r.value for r in allowed_set)},
            )
        return user

    return _check


def require_roles(*allowed: Role) -> Callable[[CurrentUser], CurrentUser]:
    return require_strict_roles(*allowed)


# 1. Super Admin Only (Cash Flow, Admin Management, Student Delete, System ON/OFF Settings, Photo Albums, Backups)
SuperAdminUser = Annotated[
    CurrentUser, Depends(require_strict_roles(Role.SUPER_ADMIN))
]

# 2. Super Admin or Restricted Admin (Fees Management, Monthly Paid/Unpaid Checks, Fee Payment Updates)
AdminUser = Annotated[
    CurrentUser, Depends(require_strict_roles(Role.SUPER_ADMIN, Role.ADMIN))
]
StaffUser = AdminUser

# 3. Student Only
StudentUser = Annotated[CurrentUser, Depends(require_strict_roles(Role.STUDENT))]


def assert_super_admin(user: CurrentUser) -> None:
    if user.role != Role.SUPER_ADMIN:
        raise AuthorizationError(
            "Only Super Admin has permission to perform this action."
        )


def assert_student_self_or_staff(
    user: CurrentUser,
    *,
    student_uuid: UUID | None = None,
    student_id_code: str | None = None,
) -> None:
    """Allow SUPER_ADMIN/ADMIN unconditionally; allow STUDENT only on their own record."""
    if user.is_admin:
        return
    if user.role == Role.STUDENT:
        if student_uuid is not None and user.id == student_uuid:
            return
        if (
            student_id_code is not None
            and user.student_id
            and user.student_id.upper() == student_id_code.strip().upper()
        ):
            return
    raise AuthorizationError("Students may only access their own record.")
