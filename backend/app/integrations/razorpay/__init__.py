"""Razorpay Orders, Signature Verification, and Webhook Gateway."""

from dataclasses import dataclass
import hashlib
import hmac
from uuid import uuid4

import httpx

from app.config import Settings
from app.core.errors import ExternalServiceError, PaymentVerificationError


@dataclass(frozen=True)
class GatewayOrder:
    id: str
    amount_paise: int
    currency: str
    status: str = "created"


class RazorpayGateway:
    def __init__(
        self,
        *,
        key_id: str,
        key_secret: str,
        webhook_secret: str,
        api_base: str = "https://api.razorpay.com/v1",
        use_live_http: bool = True,
    ) -> None:
        self._key_id = key_id or "rzp_test_brightway"
        self._key_secret = key_secret or "secret_brightway_test"
        self._webhook_secret = webhook_secret or self._key_secret
        self._api_base = api_base.rstrip("/")
        self._use_live_http = use_live_http and bool(key_id and key_secret)

    @property
    def public_key_id(self) -> str:
        return self._key_id

    def create_order(
        self,
        *,
        amount_paise: int,
        currency: str,
        receipt: str,
        notes: dict[str, str],
    ) -> GatewayOrder:
        if self._use_live_http:
            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(
                        f"{self._api_base}/orders",
                        auth=(self._key_id, self._key_secret),
                        json={
                            "amount": amount_paise,
                            "currency": currency,
                            "receipt": receipt[:40],
                            "notes": notes,
                        },
                    )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return GatewayOrder(
                        id=str(data["id"]),
                        amount_paise=int(data["amount"]),
                        currency=str(data.get("currency", currency)),
                        status=str(data.get("status", "created")),
                    )
            except Exception as exc:
                if self._key_id.startswith("rzp_live_"):
                    raise ExternalServiceError(
                        "razorpay", f"Razorpay order creation failed: {exc}"
                    ) from exc

        return GatewayOrder(
            id=f"order_{uuid4().hex[:14]}",
            amount_paise=amount_paise,
            currency=currency,
            status="created",
        )

    def verify_checkout_signature(
        self, *, order_id: str, payment_id: str, signature: str
    ) -> None:
        message = f"{order_id}|{payment_id}".encode("utf-8")
        expected = hmac.new(
            self._key_secret.encode("utf-8"), message, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, (signature or "").strip()):
            raise PaymentVerificationError(
                "Razorpay payment signature verification failed."
            )

    def verify_webhook_signature(self, *, raw_body: bytes, signature: str) -> None:
        if not signature:
            raise PaymentVerificationError("Missing X-Razorpay-Signature header.")
        expected = hmac.new(
            self._webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, signature.strip()):
            raise PaymentVerificationError(
                "Invalid X-Razorpay-Signature webhook signature."
            )


def build_razorpay_gateway(settings: Settings) -> RazorpayGateway:
    return RazorpayGateway(
        key_id=settings.razorpay_key_id,
        key_secret=settings.razorpay_key_secret.get_secret_value(),
        webhook_secret=settings.razorpay_webhook_secret.get_secret_value(),
        api_base=settings.razorpay_api_base,
        use_live_http=(settings.app_env != "test"),
    )
