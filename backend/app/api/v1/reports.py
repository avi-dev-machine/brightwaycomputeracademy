from typing import Any

from fastapi import APIRouter

from app.core.constants import get_active_month
from app.dependencies import AdminDep, ContainerDep, report_service
from app.schemas.common import ApiResponse, ok

router = APIRouter()


@router.get("/dashboard", response_model=ApiResponse[dict[str, Any]])
def dashboard(
    _user: AdminDep,
    container: ContainerDep,
    month_year: str | None = None,
    month: str | None = None,
    batch: str | None = None,
    course: str | None = None,
) -> ApiResponse[dict[str, Any]]:
    resolved_month = get_active_month(month or month_year)
    return ok(
        report_service(container).dashboard(
            month_year=resolved_month,
            batch=course or batch,
        )
    )


@router.get("/fee-ledger", response_model=ApiResponse[dict[str, Any]])
def fee_ledger_matrix(
    _user: AdminDep,
    container: ContainerDep,
    year: int = 2027,
    active_month: str | None = None,
    month: str | None = None,
    batch: str | None = None,
    course: str | None = None,
    search: str | None = None,
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 100,
) -> ApiResponse[dict[str, Any]]:
    resolved_month = get_active_month(month or active_month)
    return ok(
        report_service(container).fee_ledger_matrix(
            year=year,
            active_month=resolved_month,
            batch=course or batch,
            search=search,
            status_filter=status_filter,
            page=page,
            page_size=page_size,
        )
    )
