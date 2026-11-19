"""Role-based access control (RBAC) dependencies and ownership guards."""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.core.constants import Role
from app.core.errors import AuthorizationError
from app.core.security import AuthenticatedUser, CurrentUser


def require_roles(*allowed: Role) -> Callable[[CurrentUser], CurrentUser]:
    allowed_set = set(allowed)
    if Role.ADMIN in allowed_set or Role.SUPER_ADMIN in allowed_set:
        allowed_set.add(Role.ADMIN)
        allowed_set.add(Role.SUPER_ADMIN)

    def _check(user: AuthenticatedUser) -> CurrentUser:
        if user.role not in allowed_set:
            raise AuthorizationError(
                f"Role {user.role.value} cannot access this resource.",
                details={"required_roles": sorted(r.value for r in allowed_set)},
            )
        return user

    return _check


AdminUser = Annotated[CurrentUser, Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))]
StaffUser = Annotated[CurrentUser, Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN))]
StudentUser = Annotated[CurrentUser, Depends(require_roles(Role.STUDENT))]


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
