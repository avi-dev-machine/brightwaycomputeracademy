from typing import Any

from fastapi import APIRouter

from app.core.constants import CURRENT_ACTIVE_MONTH
from app.dependencies import (
    AdminDep,
    ContainerDep,
    CurrentUserDep,
    report_service,
    student_service,
)
from app.schemas.common import ApiResponse, ok

router = APIRouter()


@router.get("/my-ledger", response_model=ApiResponse[dict[str, Any]])
def get_my_fee_ledger(
    user: CurrentUserDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    profile = student_service(container).get_me(user)
    return ok(
        {
            "student_id": profile["student_id"],
            "name": profile["name"],
            "batch": profile["batch"],
            "monthly_fee": profile["monthly_fee"],
            "current_month": profile["current_month"],
            "current_month_status": profile["current_month_status"],
            "monthly_ledger": profile["monthly_ledger"],
            "fee_payments": profile["fee_payments"],
        }
    )


@router.get("/matrix", response_model=ApiResponse[dict[str, Any]])
def get_admin_fee_matrix(
    _user: AdminDep,
    container: ContainerDep,
    year: int = 2026,
    active_month: str = CURRENT_ACTIVE_MONTH,
    batch: str | None = None,
    search: str | None = None,
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 100,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        report_service(container).fee_ledger_matrix(
            year=year,
            active_month=active_month,
            batch=batch,
            search=search,
            status_filter=status_filter,
            page=page,
            page_size=page_size,
        )
    )
