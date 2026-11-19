"""Clean, unified Admin Portal API router (`/api/v1/admin`).

Provides a single logical namespace for all administrator operations:
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/students`
- `POST /api/v1/admin/students`
- `PUT / PATCH /api/v1/admin/students/{student_id}`
- `DELETE /api/v1/admin/students/{student_id}`
- `POST /api/v1/admin/students/{student_id}/fee-status`
"""

from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.api.v1.students import StudentWritePayload
from app.core.constants import get_active_month
from app.dependencies import (
    AdminDep,
    ContainerDep,
    payment_service,
    report_service,
    student_service,
)
from app.schemas.common import ApiResponse, ok
from app.utils.pagination import Page, PageDep

router = APIRouter()


class FeeStatusTogglePayload(BaseModel):
    status: str = Field(default="PAID", pattern=r"^(PAID|UNPAID)$")
    month: str | None = Field(default=None)
    amount: float | None = Field(default=None, ge=0)


@router.get("/dashboard", response_model=ApiResponse[dict[str, Any]])
def admin_dashboard(
    _user: AdminDep,
    container: ContainerDep,
    month: str | None = None,
    month_year: str | None = None,
    course: str | None = None,
    batch: str | None = None,
) -> ApiResponse[dict[str, Any]]:
    resolved_month = get_active_month(month or month_year)
    return ok(
        report_service(container).dashboard(
            month_year=resolved_month,
            batch=course or batch,
        )
    )


@router.get("/students", response_model=ApiResponse[Page[dict[str, Any]]])
def admin_list_students(
    page: PageDep,
    _user: AdminDep,
    container: ContainerDep,
    search: str | None = None,
    course: str | None = None,
    batch: str | None = None,
    fee_status: str | None = None,
    id_status: str | None = None,
    month: str | None = None,
    month_year: str | None = None,
) -> ApiResponse[Page[dict[str, Any]]]:
    resolved_month = get_active_month(month or month_year)
    return ok(
        student_service(container).list(
            page,
            search=search,
            course=course or batch,
            fee_status=fee_status,
            id_status=id_status,
            month_year=resolved_month,
        )
    )


@router.post(
    "/students",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def admin_create_student(
    payload: StudentWritePayload,
    _user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(student_service(container).create(payload.model_dump(exclude_none=True)))


@router.put("/students/{student_id}", response_model=ApiResponse[dict[str, Any]])
@router.patch("/students/{student_id}", response_model=ApiResponse[dict[str, Any]])
def admin_update_student(
    student_id: str,
    payload: StudentWritePayload,
    _user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        student_service(container).update(
            student_id, payload.model_dump(exclude_unset=True)
        )
    )


@router.delete("/students/{student_id}", response_model=ApiResponse[dict[str, Any]])
def admin_delete_student(
    student_id: str,
    _user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(student_service(container).delete(student_id))


@router.post(
    "/students/{student_id}/fee-status", response_model=ApiResponse[dict[str, Any]]
)
def admin_set_fee_status(
    student_id: str,
    payload: FeeStatusTogglePayload,
    user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    resolved_month = get_active_month(payload.month)
    return ok(
        payment_service(container).record_admin_payment(
            user,
            student_id=student_id,
            month_year=resolved_month,
            status=payload.status,
            amount=payload.amount,
        )
    )
