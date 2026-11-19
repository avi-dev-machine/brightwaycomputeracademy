"""Unified Institute Management Router (`/api/v1/admin`, `/api/v1/admissions`, `/api/v1/albums`).

Enforces strict Three-Level RBAC:
- `SuperAdminDep` (`SUPER_ADMIN` only): Student CRUD, Admin Management, Cash Flow (with secondary password),
  Online Admission Approval, Photo Albums Management, System ON/OFF Toggles, Activity Logs, Database Backup.
- `AdminDep` (`SUPER_ADMIN` or `ADMIN`): Monthly Fee Management (12 months), Fee Status Updates,
  Daily Collection Report, Payment Correction History, and Fee/Student Excel Exports.
"""

import json
from typing import Any

from fastapi import APIRouter, Header, Response, status
from pydantic import BaseModel, Field

from app.api.v1.students import StudentWritePayload
from app.core.constants import get_active_month
from app.dependencies import (
    AdminDep,
    ContainerDep,
    CurrentUserDep,
    SuperAdminDep,
    csv_import_service,
    payment_service,
    report_service,
    student_service,
)
from app.schemas.common import ApiResponse, ok
from app.services.management_service import ManagementService
from app.utils.pagination import Page, PageDep

router = APIRouter()
public_router = APIRouter()


def management_service(c: ContainerDep) -> ManagementService:
    return ManagementService(c.conn)


class FeeStatusTogglePayload(BaseModel):
    status: str = Field(default="PAID", pattern=r"^(PAID|UNPAID|PENDING|FAILED)$")
    month: str | None = Field(default=None)
    amount: float | None = Field(default=None, ge=0)
    payment_mode: str | None = Field(default="CASH", max_length=32)
    received_by: str | None = Field(default=None, max_length=120)
    reference: str | None = Field(default=None, max_length=120)
    remarks: str | None = Field(default=None, max_length=250)


class CreateAdminPayload(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="ADMIN", pattern=r"^(SUPER_ADMIN|ADMIN)$")
    display_name: str | None = Field(default=None, max_length=120)


class CashFlowUnlockPayload(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class ExpenseCreatePayload(BaseModel):
    description: str = Field(min_length=1, max_length=250)
    category: str = Field(default="INSTITUTE_EXPENSE", max_length=80)
    amount: float = Field(gt=0)
    payment_mode: str = Field(default="CASH", max_length=32)
    expense_date: str | None = Field(default=None, max_length=32)


class OnlineAdmissionPayload(BaseModel):
    student_name: str = Field(min_length=1, max_length=200)
    parent_name: str | None = Field(default="", max_length=200)
    dob: str | None = Field(default="", max_length=32)
    contact_number: str = Field(min_length=10, max_length=32)
    address: str | None = Field(default="", max_length=500)
    course: str = Field(default="ADOAP", max_length=120)
    admission_date: str | None = Field(default=None, max_length=32)
    photo_data_url: str | None = Field(default=None)


class ApproveAdmissionPayload(BaseModel):
    student_id: str | None = Field(default=None, max_length=64)
    monthly_fee: float | None = Field(default=600, ge=0)
    password: str | None = Field(default=None, max_length=128)


class AlbumCreatePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    year: int = Field(default=2027, ge=2000, le=2100)
    description: str | None = Field(default="", max_length=500)
    visible_to_students: bool = True


class AlbumPhotosUploadPayload(BaseModel):
    photos: list[dict[str, Any]]


# -----------------------------------------------------------------------------
# 1. Dashboard & Monthly Fee Management (Accessible to SUPER_ADMIN and ADMIN)
# -----------------------------------------------------------------------------
@router.get("/dashboard", response_model=ApiResponse[dict[str, Any]])
def admin_dashboard(
    _user: AdminDep,
    container: ContainerDep,
    month: str | None = None,
    month_year: str | None = None,
    year: int | None = None,
    course: str | None = None,
    batch: str | None = None,
    active_status: str | None = None,
) -> ApiResponse[dict[str, Any]]:
    resolved_month = get_active_month(month or month_year)
    return ok(
        report_service(container).dashboard(
            month_year=resolved_month,
            year=year,
            batch=course or batch,
            active_status=active_status,
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
    active_status: str | None = None,
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
            active_status=active_status,
            month_year=resolved_month,
        )
    )


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
    res = payment_service(container).record_admin_payment(
        user,
        student_id=student_id,
        month_year=resolved_month,
        status=payload.status,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        received_by=payload.received_by,
        reference=payload.reference,
        remarks=payload.remarks,
    )
    management_service(container).log_activity(
        user,
        "UPDATE_FEE_STATUS",
        f"{student_id} ({resolved_month})",
        {"status": payload.status, "payment_mode": payload.payment_mode},
    )
    return ok(res)


@router.get("/daily-collection", response_model=ApiResponse[dict[str, Any]])
def admin_daily_collection(
    _user: AdminDep,
    container: ContainerDep,
    date: str | None = None,
) -> ApiResponse[dict[str, Any]]:
    return ok(payment_service(container).daily_collection_report(date))


@router.get("/payment-corrections", response_model=ApiResponse[list[dict[str, Any]]])
def admin_payment_corrections(
    _user: AdminDep,
    container: ContainerDep,
    limit: int = 100,
) -> ApiResponse[list[dict[str, Any]]]:
    return ok(payment_service(container).list_payment_corrections(limit))


# -----------------------------------------------------------------------------
# 2. Excel (.xlsx) & CSV Export Endpoints
# -----------------------------------------------------------------------------
@router.get("/export/students")
def export_students_sheet(
    _user: AdminDep,
    container: ContainerDep,
    format: str = "xlsx",
    active_status: str | None = None,
    course: str | None = None,
) -> Response:
    content, media_type, filename = csv_import_service(container).export_students(
        fmt=format, active_status=active_status, course=course
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/monthly-fees")
def export_monthly_fees_sheet(
    _user: AdminDep,
    container: ContainerDep,
    month: str | None = None,
    year: int = 2027,
    format: str = "xlsx",
) -> Response:
    content, media_type, filename = csv_import_service(container).export_monthly_fees(
        year=year, month_year=month, fmt=format
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/payment-history")
def export_payment_history_sheet(
    _user: AdminDep,
    container: ContainerDep,
    format: str = "xlsx",
) -> Response:
    content, media_type, filename = csv_import_service(
        container
    ).export_payment_history(fmt=format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# -----------------------------------------------------------------------------
# 3. Student CRUD — SUPER_ADMIN ONLY
# -----------------------------------------------------------------------------
@router.post(
    "/students",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def admin_create_student(
    payload: StudentWritePayload,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    res = student_service(container).create(payload.model_dump(exclude_none=True))
    management_service(container).log_activity(
        user, "CREATE_STUDENT", f"{res['name']} ({res['student_id']})"
    )
    return ok(res)


@router.put("/students/{student_id}", response_model=ApiResponse[dict[str, Any]])
@router.patch("/students/{student_id}", response_model=ApiResponse[dict[str, Any]])
def admin_update_student(
    student_id: str,
    payload: StudentWritePayload,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    res = student_service(container).update(
        student_id, payload.model_dump(exclude_unset=True)
    )
    management_service(container).log_activity(
        user,
        "UPDATE_STUDENT",
        f"{res['name']} ({res['student_id']})",
        {"active": res.get("active")},
    )
    return ok(res)


@router.delete("/students/{student_id}", response_model=ApiResponse[dict[str, Any]])
def admin_delete_student(
    student_id: str,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    res = student_service(container).delete(student_id)
    management_service(container).log_activity(user, "DELETE_STUDENT", student_id)
    return ok(res)


# -----------------------------------------------------------------------------
# 4. Admin Accounts Management — SUPER_ADMIN ONLY
# -----------------------------------------------------------------------------
@router.get("/admins", response_model=ApiResponse[list[dict[str, Any]]])
@router.get("/users", response_model=ApiResponse[list[dict[str, Any]]])
def list_admin_accounts(
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[list[dict[str, Any]]]:
    return ok(management_service(container).list_admins(user))


@router.post(
    "/admins",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/users",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def create_admin_account(
    payload: CreateAdminPayload,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(management_service(container).create_admin(user, payload.model_dump()))


@router.delete("/admins/{admin_id}", response_model=ApiResponse[dict[str, Any]])
@router.delete("/users/{admin_id}", response_model=ApiResponse[dict[str, Any]])
def delete_admin_account(
    admin_id: str,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(management_service(container).delete_admin(user, admin_id))


# -----------------------------------------------------------------------------
# 5. Cash Flow Management — SUPER_ADMIN ONLY + Additional Password Protection
# -----------------------------------------------------------------------------
@router.post("/cash-flow/unlock", response_model=ApiResponse[dict[str, bool]])
def unlock_cash_flow(
    payload: CashFlowUnlockPayload,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, bool]]:
    return ok(
        management_service(container).verify_cashflow_access(user, payload.password)
    )


@router.get("/cash-flow", response_model=ApiResponse[dict[str, Any]])
def get_cash_flow(
    user: SuperAdminDep,
    container: ContainerDep,
    year: int = 2027,
    month: str | None = None,
    date: str | None = None,
    cashflow_password: str | None = None,
    x_cashflow_password: str | None = Header(default=None, alias="X-Cashflow-Password"),
) -> ApiResponse[dict[str, Any]]:
    pwd = x_cashflow_password or cashflow_password
    return ok(
        management_service(container).get_cashflow_dashboard(
            user,
            pwd,
            year=year,
            month_year=month,
            date_str=date,
        )
    )


@router.post(
    "/cash-flow/expenses",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def add_cash_flow_expense(
    payload: ExpenseCreatePayload,
    user: SuperAdminDep,
    container: ContainerDep,
    cashflow_password: str | None = None,
    x_cashflow_password: str | None = Header(default=None, alias="X-Cashflow-Password"),
) -> ApiResponse[dict[str, Any]]:
    pwd = x_cashflow_password or cashflow_password
    return ok(
        management_service(container).add_expense(
            user, pwd, payload.model_dump(exclude_none=True)
        )
    )


@router.delete(
    "/cash-flow/expenses/{expense_id}", response_model=ApiResponse[dict[str, Any]]
)
def delete_cash_flow_expense(
    expense_id: str,
    user: SuperAdminDep,
    container: ContainerDep,
    cashflow_password: str | None = None,
    x_cashflow_password: str | None = Header(default=None, alias="X-Cashflow-Password"),
) -> ApiResponse[dict[str, Any]]:
    pwd = x_cashflow_password or cashflow_password
    return ok(
        management_service(container).delete_expense(user, pwd, expense_id)
    )


# -----------------------------------------------------------------------------
# 6. Online Admission Approvals — SUPER_ADMIN ONLY
# -----------------------------------------------------------------------------
@router.get("/admissions", response_model=ApiResponse[list[dict[str, Any]]])
def list_online_admissions(
    user: SuperAdminDep,
    container: ContainerDep,
    status: str | None = None,
) -> ApiResponse[list[dict[str, Any]]]:
    return ok(management_service(container).list_admissions(user, status))


@router.post(
    "/admissions/{admission_id}/approve", response_model=ApiResponse[dict[str, Any]]
)
def approve_online_admission(
    admission_id: str,
    payload: ApproveAdmissionPayload,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        management_service(container).approve_admission(
            user, admission_id, payload.model_dump(exclude_none=True)
        )
    )


@router.post(
    "/admissions/{admission_id}/reject", response_model=ApiResponse[dict[str, Any]]
)
def reject_online_admission(
    admission_id: str,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(management_service(container).reject_admission(user, admission_id))


# -----------------------------------------------------------------------------
# 7. Year-Wise Photo Album Management — SUPER_ADMIN ONLY
# -----------------------------------------------------------------------------
@router.get("/albums", response_model=ApiResponse[list[dict[str, Any]]])
def admin_list_albums(
    _user: SuperAdminDep,
    container: ContainerDep,
    year: int | None = None,
) -> ApiResponse[list[dict[str, Any]]]:
    return ok(
        management_service(container).list_photo_albums(year=year, for_student=False)
    )


@router.post(
    "/albums",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def admin_create_album(
    payload: AlbumCreatePayload,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        management_service(container).create_photo_album(user, payload.model_dump())
    )


@router.post(
    "/albums/{album_id}/photos", response_model=ApiResponse[dict[str, Any]]
)
def admin_add_album_photos(
    album_id: str,
    payload: AlbumPhotosUploadPayload,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        management_service(container).add_photos_to_album(
            user, album_id, payload.photos
        )
    )


@router.delete(
    "/albums/{album_id}/photos/{photo_id}",
    response_model=ApiResponse[dict[str, Any]],
)
def admin_delete_album_photo(
    album_id: str,
    photo_id: str,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        management_service(container).delete_photo_from_album(
            user, album_id, photo_id
        )
    )


@router.delete("/albums/{album_id}", response_model=ApiResponse[dict[str, Any]])
def admin_delete_album(
    album_id: str,
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(management_service(container).delete_photo_album(user, album_id))


# -----------------------------------------------------------------------------
# 8. System ON/OFF Controls, Activity Logs & Database Backup — SUPER_ADMIN ONLY
# -----------------------------------------------------------------------------
@router.get("/settings", response_model=ApiResponse[dict[str, Any]])
def get_admin_settings(
    _user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(management_service(container).get_system_settings())


@router.put("/settings", response_model=ApiResponse[dict[str, Any]])
@router.patch("/settings", response_model=ApiResponse[dict[str, Any]])
def update_admin_settings(
    payload: dict[str, Any],
    user: SuperAdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(management_service(container).update_system_settings(user, payload))


@router.get("/activity-logs", response_model=ApiResponse[list[dict[str, Any]]])
def list_admin_activity_logs(
    _user: SuperAdminDep,
    container: ContainerDep,
    limit: int = 100,
) -> ApiResponse[list[dict[str, Any]]]:
    return ok(management_service(container).list_activity_logs(limit))


@router.get("/backup")
def download_database_backup(
    user: SuperAdminDep,
    container: ContainerDep,
) -> Response:
    snapshot = management_service(container).export_full_backup(user)
    raw = json.dumps(snapshot, indent=2, default=str).encode("utf-8")
    return Response(
        content=raw,
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="Brightway-Database-Backup.json"'
        },
    )


# -----------------------------------------------------------------------------
# 9. Public & Student Accessible Endpoints (Admissions, Albums, Public Settings)
# -----------------------------------------------------------------------------
@public_router.get("/public/settings", response_model=ApiResponse[dict[str, Any]])
def get_public_settings(container: ContainerDep) -> ApiResponse[dict[str, Any]]:
    return ok(management_service(container).get_system_settings())


@public_router.post(
    "/admissions/submit",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
@public_router.post(
    "/admissions",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def submit_online_admission(
    payload: OnlineAdmissionPayload,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        management_service(container).submit_admission(
            payload.model_dump(exclude_none=True)
        )
    )


@public_router.get("/albums", response_model=ApiResponse[list[dict[str, Any]]])
def list_student_photo_albums(
    container: ContainerDep,
    year: int | None = None,
    _user: CurrentUserDep | None = None,
) -> ApiResponse[list[dict[str, Any]]]:
    return ok(
        management_service(container).list_photo_albums(year=year, for_student=True)
    )
