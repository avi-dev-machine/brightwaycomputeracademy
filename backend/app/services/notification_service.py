"""Multi-channel Notification Dispatcher (WhatsApp, Email, SMS) for Fee Reminders (MongoDB Atlas)."""

import os
import re
import smtplib
import urllib.parse
from datetime import UTC, datetime
from decimal import Decimal
from email.message import EmailMessage
from typing import Any
from uuid import UUID, uuid4

from pymongo import ASCENDING
from pymongo.database import Database as MongoDatabase

from app.config import Settings, get_settings
from app.core.constants import format_month_label, get_active_month
from app.core.errors import NotFoundError
from app.integrations.messaging import MessagingGateway


def _build_reminder_message(
    *,
    name: str,
    student_id: str,
    course: str,
    month_year: str,
    amount: Decimal,
    public_app_url: str,
) -> tuple[str, str]:
    base_url = (public_app_url or "http://localhost:3000").rstrip("/")
    pay_link = (
        f"{base_url}/login?student_id={urllib.parse.quote(student_id)}"
        if student_id
        else f"{base_url}/login"
    )
    month_label = format_month_label(month_year)
    id_display = student_id or "Pending ID"
    text = (
        f"Brightway Computer Academy Reminder: Dear {name} (ID: {id_display}, Course: {course}), "
        f"your monthly fee of INR {amount:.2f} for {month_label} is currently UNPAID. "
        f"Please complete your payment online via Razorpay at: {pay_link}"
    )
    return text, pay_link


def _build_wa_me_url(contact_number: str, message: str) -> str | None:
    digits = "".join(ch for ch in (contact_number or "") if ch.isdigit())
    if len(digits) < 10 or digits == "0000000000":
        return None
    phone_e164 = f"91{digits[-10:]}" if len(digits) == 10 else digits
    return f"https://wa.me/{phone_e164}?text={urllib.parse.quote(message)}"


class NotificationService:
    def __init__(
        self,
        conn: MongoDatabase[dict[str, Any]],
        gateway: MessagingGateway,
        settings: Settings | None = None,
    ) -> None:
        self._db = conn
        self._gateway = gateway
        self._settings = settings or get_settings()

    def _send_email_if_configured(
        self, recipient_email: str, subject: str, body: str
    ) -> tuple[str, str | None]:
        smtp_host = os.environ.get("SMTP_HOST", "").strip()
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER", "").strip()
        smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip()
        smtp_from = os.environ.get(
            "SMTP_FROM", smtp_user or "fees@brightwayacademy.edu.in"
        )

        if not smtp_host or not recipient_email or "@" not in recipient_email:
            return "SIMULATED_QUEUED", f"email-queued-{uuid4().hex[:10]}"

        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = recipient_email
            msg.set_content(body)
            with smtplib.SMTP(smtp_host, smtp_port, timeout=8) as server:
                server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            return "SENT", f"smtp-{uuid4().hex[:10]}"
        except Exception as exc:
            return f"QUEUED ({exc})", f"email-fallback-{uuid4().hex[:8]}"

    def send_student_reminder(
        self,
        *,
        student_id: str,
        month_year: str | None = None,
        channels: list[str] | None = None,
        email: str | None = None,
        custom_message: str | None = None,
        student_doc: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        resolved_month = get_active_month(month_year)
        row = student_doc
        if row is None:
            code = student_id.strip()
            try:
                uid = UUID(code)
                row = self._db["students"].find_one({"id": str(uid)})
            except ValueError:
                pass
            if row is None:
                row = self._db["students"].find_one(
                    {"student_id": code.upper()}
                ) or self._db["students"].find_one(
                    {"student_id": {"$regex": f"^{re.escape(code)}$", "$options": "i"}}
                )
        if not row:
            raise NotFoundError("student", student_id)

        selected_channels = [
            c.strip().upper()
            for c in (channels or ["WHATSAPP", "SMS", "EMAIL"])
            if c.strip()
        ]
        fee_amount = Decimal(str(row.get("monthly_fee", 600))).quantize(Decimal("0.01"))
        course = row.get("course") or row.get("batch") or "GENERAL"
        s_code = row.get("student_id") or ""
        default_msg, pay_link = _build_reminder_message(
            name=row["name"],
            student_id=s_code,
            course=course,
            month_year=resolved_month,
            amount=fee_amount,
            public_app_url=self._settings.public_app_url,
        )
        body = (
            custom_message.strip()
            if (custom_message and custom_message.strip())
            else default_msg
        )
        phone = row.get("contact_number") or ""
        wa_url = _build_wa_me_url(phone, body)

        channel_results: list[dict[str, Any]] = []
        for ch in selected_channels:
            if ch == "WHATSAPP":
                res = self._gateway.send_whatsapp(recipient_phone=phone, body=body)
                channel_results.append(
                    {
                        "channel": "WHATSAPP",
                        "recipient": phone,
                        "status": "SENT" if res.ok else "READY_LINK",
                        "provider": res.provider,
                        "provider_message_id": res.provider_message_id,
                        "whatsapp_url": wa_url,
                        "error": res.error,
                    }
                )
            elif ch == "SMS":
                res = self._gateway.send_sms(recipient_phone=phone, body=body)
                channel_results.append(
                    {
                        "channel": "SMS",
                        "recipient": phone,
                        "status": "SENT" if res.ok else "DISPATCHED_FALLBACK",
                        "provider": res.provider,
                        "provider_message_id": res.provider_message_id,
                        "error": res.error,
                    }
                )
            elif ch == "EMAIL":
                slug = (s_code or str(row["id"])[:8]).lower()
                target_email = (
                    email or f"{slug}@student.brightwayacademy.edu.in"
                )
                subject = f"Brightway Computer Academy - Fee Reminder ({format_month_label(resolved_month)})"
                em_status, em_id = self._send_email_if_configured(
                    target_email, subject, body
                )
                mailto_url = (
                    f"mailto:{urllib.parse.quote(target_email)}"
                    f"?subject={urllib.parse.quote(subject)}"
                    f"&body={urllib.parse.quote(body)}"
                )
                channel_results.append(
                    {
                        "channel": "EMAIL",
                        "recipient": target_email,
                        "status": em_status,
                        "provider": "smtp_or_sendgrid",
                        "provider_message_id": em_id,
                        "mailto_url": mailto_url,
                    }
                )

        return {
            "id": str(uuid4()),
            "student_id": s_code or str(row["id"]),
            "student_name": row["name"],
            "contact_number": phone,
            "course": course,
            "batch": course,
            "month_year": resolved_month,
            "month_label": format_month_label(resolved_month),
            "amount": float(fee_amount),
            "payment_link": pay_link,
            "whatsapp_url": wa_url,
            "message": body,
            "channels": channel_results,
            "dispatched_at": datetime.now(tz=UTC).isoformat(),
        }

    def send_bulk_reminders(
        self,
        *,
        month_year: str | None = None,
        batch: str | None = None,
        channels: list[str] | None = None,
        student_ids: list[str] | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        resolved_month = get_active_month(month_year)
        paid_docs = list(
            self._db["fee_payments"].find(
                {"month_year": resolved_month, "status": "PAID"},
                {"student_key": 1, "student_id": 1, "_id": 0},
            )
        )
        paid_keys = [d["student_key"] for d in paid_docs if d.get("student_key")]
        paid_codes = [d["student_id"] for d in paid_docs if d.get("student_id")]

        mongo_filter: dict[str, Any] = {"id": {"$nin": paid_keys}}
        if paid_codes:
            mongo_filter["student_id"] = {"$nin": paid_codes}

        if batch and batch.strip() and batch.strip().upper() != "ALL":
            b_val = batch.strip()
            mongo_filter["$or"] = [{"course": b_val}, {"batch": b_val}]

        if student_ids:
            clean_ids = [s.strip().upper() for s in student_ids if s.strip()]
            if clean_ids:
                mongo_filter["$or"] = [
                    {"student_id": {"$in": clean_ids}},
                    {"id": {"$in": [s.strip() for s in student_ids if s.strip()]}},
                ]

        rows = list(
            self._db["students"]
            .find(mongo_filter)
            .sort([("name", ASCENDING)])
            .limit(max(1, min(limit, 500)))
        )

        dispatches: list[dict[str, Any]] = []
        for r in rows:
            dispatch = self.send_student_reminder(
                student_id=r.get("student_id") or str(r["id"]),
                month_year=resolved_month,
                channels=channels,
                student_doc=r,
            )
            dispatches.append(dispatch)

        return {
            "month_year": resolved_month,
            "month_label": format_month_label(resolved_month),
            "batch": batch or "ALL",
            "channels": channels or ["WHATSAPP", "SMS", "EMAIL"],
            "total_unpaid_targeted": len(dispatches),
            "sent_count": len(dispatches),
            "dispatches": dispatches,
            "completed_at": datetime.now(tz=UTC).isoformat(),
        }
