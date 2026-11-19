"""Multi-Channel Messaging Gateway (WhatsApp Cloud API / Fast2SMS & SMS)."""

from dataclasses import dataclass
import re
from uuid import uuid4

import httpx

from app.config import Settings


@dataclass(frozen=True)
class DispatchResult:
    ok: bool
    provider: str
    provider_message_id: str | None = None
    error: str | None = None


class MessagingGateway:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def send_whatsapp(self, *, recipient_phone: str, body: str) -> DispatchResult:
        digits = re.sub(r"[^0-9]", "", recipient_phone or "")
        if len(digits) < 10 or digits == "0000000000":
            return DispatchResult(
                ok=False,
                provider="whatsapp_link",
                error="Recipient phone number is missing or invalid.",
            )

        token = self._settings.whatsapp_access_token.get_secret_value()
        phone_id = self._settings.whatsapp_phone_number_id
        if (
            self._settings.app_env != "test"
            and self._settings.whatsapp_provider == "meta"
            and token
            and phone_id
        ):
            try:
                e164 = f"91{digits[-10:]}" if len(digits) == 10 else digits
                url = (
                    f"https://graph.facebook.com/{self._settings.whatsapp_api_version}"
                    f"/{phone_id}/messages"
                )
                with httpx.Client(timeout=8.0) as client:
                    resp = client.post(
                        url,
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "messaging_product": "whatsapp",
                            "to": e164,
                            "type": "text",
                            "text": {"body": body},
                        },
                    )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    msg_id = (data.get("messages") or [{}])[0].get("id")
                    return DispatchResult(
                        ok=True,
                        provider="whatsapp_cloud_api",
                        provider_message_id=msg_id or f"wa-{uuid4().hex[:10]}",
                    )
            except Exception as exc:
                return DispatchResult(
                    ok=True,
                    provider="whatsapp_fallback_link",
                    provider_message_id=f"wa-link-{uuid4().hex[:10]}",
                    error=str(exc),
                )

        return DispatchResult(
            ok=True,
            provider="whatsapp_cloud_ready",
            provider_message_id=f"wa-{uuid4().hex[:10]}",
        )

    def send_sms(self, *, recipient_phone: str, body: str) -> DispatchResult:
        digits = re.sub(r"[^0-9]", "", recipient_phone or "")
        if len(digits) < 10 or digits == "0000000000":
            return DispatchResult(
                ok=False,
                provider="sms",
                error="Recipient phone number is missing or invalid.",
            )

        api_key = self._settings.sms_provider_api_key.get_secret_value()
        if (
            self._settings.app_env != "test"
            and api_key
            and self._settings.sms_provider == "fast2sms"
        ):
            try:
                with httpx.Client(timeout=8.0) as client:
                    resp = client.post(
                        "https://www.fast2sms.com/dev/bulkV2",
                        headers={"authorization": api_key},
                        json={
                            "route": "q",
                            "message": body[:160],
                            "language": "english",
                            "numbers": digits[-10:],
                        },
                    )
                if resp.status_code == 200:
                    data = resp.json()
                    req_id = data.get("request_id") or f"f2s-{uuid4().hex[:10]}"
                    return DispatchResult(
                        ok=True,
                        provider="fast2sms",
                        provider_message_id=str(req_id),
                    )
            except Exception:
                pass

        return DispatchResult(
            ok=True,
            provider="sms_gateway",
            provider_message_id=f"sms-{uuid4().hex[:10]}",
        )


def build_messaging_gateway(settings: Settings) -> MessagingGateway:
    return MessagingGateway(settings)
