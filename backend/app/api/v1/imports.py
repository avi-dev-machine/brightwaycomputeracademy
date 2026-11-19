from typing import Any

from fastapi import APIRouter, File, Form, Response, UploadFile, status

from app.dependencies import AdminDep, ContainerDep, SuperAdminDep, csv_import_service
from app.schemas.common import ApiResponse, ok

router = APIRouter()


@router.post(
    "/csv",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/excel",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def import_excel_or_csv(
    _user: SuperAdminDep,
    container: ContainerDep,
    file: UploadFile = File(...),
    dry_run: bool = Form(default=False),
) -> ApiResponse[dict[str, Any]]:
    """Parse and upsert student records from Excel (.xlsx) or CSV (.csv)."""
    file.file.seek(0)
    result = csv_import_service(container).ingest_stream(
        file.file,
        filename=file.filename or "students.xlsx",
        dry_run=dry_run,
    )
    return ok(result)


@router.get("/export/students.xlsx")
def export_students_xlsx(
    _user: AdminDep,
    container: ContainerDep,
    active_status: str | None = None,
    course: str | None = None,
) -> Response:
    content, media_type, filename = csv_import_service(container).export_students(
        fmt="xlsx", active_status=active_status, course=course
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/students.csv")
def export_students_csv(
    _user: AdminDep,
    container: ContainerDep,
    active_status: str | None = None,
    course: str | None = None,
) -> Response:
    content, media_type, filename = csv_import_service(container).export_students(
        fmt="csv", active_status=active_status, course=course
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/monthly-fees.xlsx")
def export_monthly_fees_xlsx(
    _user: AdminDep,
    container: ContainerDep,
    month: str | None = None,
    year: int = 2027,
) -> Response:
    content, media_type, filename = csv_import_service(container).export_monthly_fees(
        year=year, month_year=month, fmt="xlsx"
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/monthly-fees.csv")
def export_monthly_fees_csv(
    _user: AdminDep,
    container: ContainerDep,
    month: str | None = None,
    year: int = 2027,
) -> Response:
    content, media_type, filename = csv_import_service(container).export_monthly_fees(
        year=year, month_year=month, fmt="csv"
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/payments.xlsx")
def export_payments_xlsx(
    _user: AdminDep,
    container: ContainerDep,
) -> Response:
    content, media_type, filename = csv_import_service(
        container
    ).export_payment_history(fmt="xlsx")
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/payments.csv")
def export_payments_csv(
    _user: AdminDep,
    container: ContainerDep,
) -> Response:
    content, media_type, filename = csv_import_service(
        container
    ).export_payment_history(fmt="csv")
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
