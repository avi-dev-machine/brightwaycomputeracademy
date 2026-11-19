from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.core.constants import CURRENT_ACTIVE_MONTH
from app.dependencies import AdminDep, ContainerDep, notification_service
from app.schemas.common import ApiResponse, ok

router = APIRouter()


class SingleReminderPayload(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    month_year: str = Field(
        default=CURRENT_ACTIVE_MONTH, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"
    )
    channels: list[str] = Field(default_factory=lambda: ["WHATSAPP", "SMS", "EMAIL"])
    email: str | None = Field(default=None, max_length=254)
    custom_message: str | None = Field(default=None, max_length=1000)


class BulkReminderPayload(BaseModel):
    month_year: str = Field(
        default=CURRENT_ACTIVE_MONTH, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"
    )
    batch: str | None = Field(default=None, max_length=120)
    channels: list[str] = Field(default_factory=lambda: ["WHATSAPP", "SMS", "EMAIL"])
    student_ids: list[str] | None = Field(default=None)
    limit: int = Field(default=100, ge=1, le=500)


@router.post(
    "/send-reminder",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def send_student_reminder(
    payload: SingleReminderPayload,
    _user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        notification_service(container).send_student_reminder(
            student_id=payload.student_id,
            month_year=payload.month_year,
            channels=payload.channels,
            email=payload.email,
            custom_message=payload.custom_message,
        )
    )


@router.post("/bulk-reminders", response_model=ApiResponse[dict[str, Any]])
@router.post("/run-due-reminders", response_model=ApiResponse[dict[str, Any]])
def send_bulk_reminders(
    payload: BulkReminderPayload,
    _user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        notification_service(container).send_bulk_reminders(
            month_year=payload.month_year,
            batch=payload.batch,
            channels=payload.channels,
            student_ids=payload.student_ids,
            limit=payload.limit,
        )
    )
