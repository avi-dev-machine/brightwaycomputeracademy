from typing import Any
from uuid import UUID

from fastapi import APIRouter, Header, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import get_active_month
from app.dependencies import (
    AdminDep,
    ContainerDep,
    CurrentUserDep,
    payment_service,
)
from app.schemas.common import ApiResponse, ok
from app.utils.pagination import Page, PageDep
from app.utils.rate_limit import client_ip

router = APIRouter()


class CreateOrderPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    month_year: str | None = Field(
        default=None,
        description="Target billing month in YYYY-MM format (defaults to active month 2027-12)",
    )
    student_id: str | None = Field(
        default=None,
        max_length=64,
    )


class VerifyPaymentPayload(BaseModel):
    razorpay_order_id: str = Field(min_length=4, max_length=128)
    razorpay_payment_id: str = Field(min_length=4, max_length=128)
    razorpay_signature: str = Field(min_length=16, max_length=256)


class AdminRecordPaymentPayload(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    month_year: str | None = Field(default=None)
    status: str = Field(default="PAID", pattern=r"^(PAID|PENDING|FAILED|UNPAID)$")
    amount: float | None = Field(default=None, ge=0)
    reference: str | None = Field(default=None, max_length=120)


@router.get("", response_model=ApiResponse[Page[dict[str, Any]]])
def list_payments(
    page: PageDep,
    user: CurrentUserDep,
    container: ContainerDep,
    student_id: str | None = None,
    status: str | None = None,
    month_year: str | None = None,
) -> ApiResponse[Page[dict[str, Any]]]:
    return ok(
        payment_service(container).list_payments(
            user,
            page,
            student_id=student_id,
            status=status,
            month_year=month_year,
        )
    )


@router.post(
    "/create-order",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    payload: CreateOrderPayload,
    user: CurrentUserDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    container.payment_limiter.hit(f"user:{user.id}")
    return ok(
        payment_service(container).create_order(
            user,
            month_year=get_active_month(payload.month_year),
            student_id=payload.student_id,
        )
    )


@router.post("/verify", response_model=ApiResponse[dict[str, Any]])
def verify_payment(
    payload: VerifyPaymentPayload,
    user: CurrentUserDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    container.payment_limiter.hit(f"user:{user.id}")
    return ok(
        payment_service(container).verify_checkout(
            user,
            razorpay_order_id=payload.razorpay_order_id,
            razorpay_payment_id=payload.razorpay_payment_id,
            razorpay_signature=payload.razorpay_signature,
        )
    )


@router.post("/webhooks/razorpay", response_model=ApiResponse[dict[str, Any]])
@router.post("/webhook", response_model=ApiResponse[dict[str, Any]])
async def razorpay_webhook(
    request: Request,
    container: ContainerDep,
    x_razorpay_signature: str = Header(default="", alias="X-Razorpay-Signature"),
) -> ApiResponse[dict[str, Any]]:
    container.webhook_limiter.hit(f"ip:{client_ip(request)}")
    raw_body = await request.body()
    return ok(
        payment_service(container).handle_webhook(
            raw_body=raw_body, signature=x_razorpay_signature
        )
    )


@router.post("/admin-record", response_model=ApiResponse[dict[str, Any]])
def admin_record_payment(
    payload: AdminRecordPaymentPayload,
    user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        payment_service(container).record_admin_payment(
            user,
            student_id=payload.student_id,
            month_year=get_active_month(payload.month_year),
            status=payload.status,
            amount=payload.amount,
            reference=payload.reference,
        )
    )


@router.get("/{payment_id}", response_model=ApiResponse[dict[str, Any]])
def get_payment(
    payment_id: UUID, user: CurrentUserDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    return ok(payment_service(container).get_payment(user, payment_id))


@router.get("/{payment_id}/receipt.pdf")
def download_receipt_pdf(
    payment_id: UUID, user: CurrentUserDep, container: ContainerDep
) -> Response:
    pdf_bytes, filename = payment_service(container).render_receipt_pdf(user, payment_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
