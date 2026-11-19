"""Server-side Razorpay Order Creation, Cryptographic Verification, Offline Cash Collection,
Payment Correction History, Daily Collection Report, and PDF Receipt Generator.
"""

import json
import re
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fpdf import FPDF
from pymongo import ReturnDocument

from app.core.constants import CURRENCY, format_month_label, get_active_month
from app.core.errors import (
    ConflictError,
    NotFoundError,
    PaymentVerificationError,
    ValidationError,
)
from app.core.permissions import assert_student_self_or_staff
from app.core.security import CurrentUser
from app.integrations.razorpay import RazorpayGateway
from app.utils.pagination import Page, PageParams

_MONTH_YEAR_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _validate_month_year(month_year: str | None) -> str:
    val = get_active_month(month_year)
    if not _MONTH_YEAR_RE.match(val):
        raise ValidationError("month_year must be in YYYY-MM format (e.g. 2027-12).")
    return val


def _format_payment_row(
    row: dict[str, Any], student_name: str | None = None, course: str | None = None
) -> dict[str, Any]:
    amt = Decimal(str(row.get("amount", 0))).quantize(Decimal("0.01"))
    p_date = row.get("payment_date")
    p_iso = p_date.isoformat() if isinstance(p_date, datetime) else p_date
    m_yr = row.get("month_year") or get_active_month()
    c_val = course or row.get("course") or row.get("batch")
    p_mode = row.get("payment_mode") or (
        "RAZORPAY"
        if str(row.get("razorpay_payment_id") or "").startswith("pay_")
        else "CASH"
    )
    return {
        "id": str(row["id"]),
        "student_key": row.get("student_key"),
        "student_id": row.get("student_id") or "",
        "student_name": student_name or row.get("student_name") or "",
        "course": c_val,
        "batch": c_val,
        "amount": float(amt),
        "amount_paise": int(amt * 100),
        "currency": CURRENCY,
        "month": m_yr,
        "month_year": m_yr,
        "month_label": format_month_label(m_yr),
        "razorpay_order_id": row.get("razorpay_order_id"),
        "razorpay_payment_id": row.get("razorpay_payment_id"),
        "transaction_id": row.get("razorpay_payment_id")
        or row.get("razorpay_order_id")
        or f"RCP-{str(row['id'])[:8].upper()}",
        "status": row.get("status", "UNPAID"),
        "payment_date": p_iso,
        "paid_at": p_iso,
        "payment_mode": p_mode,
        "method": p_mode,
        "received_by": row.get("received_by")
        or ("Razorpay Online" if p_mode != "CASH" else "Admin Desk"),
        "remarks": row.get("remarks") or "",
    }


class PaymentService:
    def __init__(
        self,
        conn: Any,
        gateway: RazorpayGateway,
    ) -> None:
        self._db = conn
        self._gateway = gateway

    def _resolve_student(
        self, actor: CurrentUser, requested_student_id: str | UUID | None = None
    ) -> dict[str, Any]:
        target = requested_student_id
        if target is None:
            target = actor.id or actor.student_id

        row = None
        try:
            uid = UUID(str(target))
            row = self._db["students"].find_one({"id": str(uid)})
        except ValueError:
            pass

        if row is None:
            code = str(target).strip()
            if code:
                row = self._db["students"].find_one(
                    {"student_id": code.upper()}
                ) or self._db["students"].find_one(
                    {"student_id": {"$regex": f"^{re.escape(code)}$", "$options": "i"}}
                )

        if row is None:
            raise NotFoundError("student", target)

        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(row["id"])),
            student_id_code=row.get("student_id"),
        )
        return dict(row)

    def _record_correction_log(
        self,
        *,
        actor: CurrentUser,
        student_name: str,
        student_id: str,
        month_year: str,
        previous_status: str,
        new_status: str,
        previous_amount: float,
        new_amount: float,
        payment_mode: str,
        received_by: str,
        remarks: str = "",
    ) -> None:
        doc = {
            "id": str(uuid4()),
            "student_name": student_name,
            "student_id": student_id,
            "month_year": month_year,
            "month_label": format_month_label(month_year),
            "previous_status": previous_status,
            "new_status": new_status,
            "previous_amount": previous_amount,
            "new_amount": new_amount,
            "payment_mode": payment_mode,
            "received_by": received_by,
            "remarks": remarks,
            "updated_by": actor.identifier or actor.full_name or "Admin",
            "updated_by_role": actor.role.value,
            "created_at": datetime.now(tz=UTC).isoformat(),
        }
        self._db["payment_corrections"].insert_one(doc)

    def create_order(
        self,
        actor: CurrentUser,
        *,
        month_year: str | None = None,
        student_id: str | UUID | None = None,
    ) -> dict[str, Any]:
        """Initialize a Razorpay order using the server-side `monthly_fee` from `students`."""
        target_month = _validate_month_year(month_year)
        student = self._resolve_student(actor, student_id)
        student_uuid_str = str(student["id"])
        student_code: str = student.get("student_id") or student_uuid_str[:8].upper()
        course: str = student.get("course") or student.get("batch") or "GENERAL"

        monthly_fee = Decimal(str(student.get("monthly_fee", 600))).quantize(
            Decimal("0.01")
        )
        if monthly_fee <= Decimal("0.00"):
            monthly_fee = Decimal("600.00")
        amount_paise = int(monthly_fee * 100)

        existing = self._db["fee_payments"].find_one(
            {
                "$or": [
                    {"student_key": student_uuid_str, "month_year": target_month},
                    *(
                        [{"student_id": student_code, "month_year": target_month}]
                        if student.get("student_id")
                        else []
                    ),
                ]
            }
        )
        if existing and existing.get("status") == "PAID":
            raise ConflictError(
                f"Monthly fee for {format_month_label(target_month)} is already marked as PAID."
            )

        receipt_ref = (
            f"bw_{re.sub(r'[^A-Za-z0-9]', '', student_code)[:16]}_{target_month}"
        )
        gw_order = self._gateway.create_order(
            amount_paise=amount_paise,
            currency=CURRENCY,
            receipt=receipt_ref,
            notes={
                "student_key": student_uuid_str,
                "student_id": student_code,
                "student_name": student["name"],
                "course": course,
                "month_year": target_month,
            },
        )

        # Do NOT mark online payments as successful until payment verification is completed
        row = self._db["fee_payments"].find_one_and_update(
            {"student_key": student_uuid_str, "month_year": target_month},
            {
                "$set": {
                    "student_key": student_uuid_str,
                    "student_id": student.get("student_id") or "",
                    "student_name": student["name"],
                    "course": course,
                    "amount": float(monthly_fee),
                    "razorpay_order_id": gw_order.id,
                    "payment_mode": "RAZORPAY",
                    "status": "PENDING",
                },
                "$setOnInsert": {
                    "id": str(uuid4()),
                    "month_year": target_month,
                    "razorpay_payment_id": None,
                    "payment_date": None,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        return {
            "payment_id": str(row["id"]),
            "order_id": gw_order.id,
            "razorpay_order_id": gw_order.id,
            "key_id": self._gateway.public_key_id,
            "amount": float(monthly_fee),
            "amount_paise": amount_paise,
            "currency": CURRENCY,
            "student_id": student_code,
            "student_name": student["name"],
            "student_email": None,
            "student_phone": student.get("contact_number") or "",
            "course": course,
            "batch": course,
            "month": target_month,
            "month_year": target_month,
            "month_label": format_month_label(target_month),
            "fee_description": f"Brightway Monthly Fee - {format_month_label(target_month)}",
        }

    def verify_checkout(
        self,
        actor: CurrentUser,
        *,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> dict[str, Any]:
        """Cryptographically verify Razorpay signature and mark `fee_payments` as PAID."""
        payment_row = self._db["fee_payments"].find_one(
            {"razorpay_order_id": razorpay_order_id}
        )
        if not payment_row:
            raise NotFoundError("fee_payment_order", razorpay_order_id)

        student = None
        if payment_row.get("student_key"):
            student = self._db["students"].find_one(
                {"id": payment_row["student_key"]}
            )
        if not student and payment_row.get("student_id"):
            student = self._db["students"].find_one(
                {"student_id": payment_row["student_id"]}
            )
        if not student:
            raise NotFoundError(
                "student", payment_row.get("student_id") or payment_row.get("student_key")
            )

        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(student["id"])),
            student_id_code=student.get("student_id"),
        )

        self._gateway.verify_checkout_signature(
            order_id=razorpay_order_id,
            payment_id=razorpay_payment_id,
            signature=razorpay_signature,
        )

        course = student.get("course") or student.get("batch") or "GENERAL"
        if payment_row.get("status") == "PAID":
            return _format_payment_row(
                dict(payment_row),
                student_name=student["name"],
                course=course,
            )

        now = datetime.now(tz=UTC)
        updated = self._db["fee_payments"].find_one_and_update(
            {"id": str(payment_row["id"])},
            {
                "$set": {
                    "status": "PAID",
                    "payment_mode": "RAZORPAY",
                    "received_by": "Razorpay Online Verified",
                    "razorpay_payment_id": razorpay_payment_id,
                    "payment_date": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )

        return _format_payment_row(
            dict(updated),
            student_name=student["name"],
            course=course,
        )

    def handle_webhook(self, *, raw_body: bytes, signature: str) -> dict[str, Any]:
        self._gateway.verify_webhook_signature(raw_body=raw_body, signature=signature)
        try:
            event = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PaymentVerificationError("Webhook body is not valid JSON.") from exc

        event_type = str(event.get("event") or "unknown")
        payload_obj = event.get("payload") or {}
        payment_entity = (payload_obj.get("payment") or {}).get("entity") or {}
        order_entity = (payload_obj.get("order") or {}).get("entity") or {}

        order_id = payment_entity.get("order_id") or order_entity.get("id")
        rp_payment_id = payment_entity.get("id")

        if not order_id:
            return {"status": "ignored", "reason": "no_order_id", "event": event_type}

        payment_row = self._db["fee_payments"].find_one(
            {"razorpay_order_id": order_id}
        )
        if not payment_row:
            return {
                "status": "ignored",
                "reason": "unknown_order",
                "order_id": order_id,
            }

        if event_type in ("payment.captured", "order.paid"):
            if payment_row.get("status") == "PAID":
                return {
                    "status": "duplicate",
                    "payment_id": str(payment_row["id"]),
                    "student_id": payment_row.get("student_id"),
                }
            self._db["fee_payments"].update_one(
                {"id": str(payment_row["id"])},
                {
                    "$set": {
                        "status": "PAID",
                        "payment_mode": "RAZORPAY",
                        "received_by": "Razorpay Webhook Verified",
                        "razorpay_payment_id": rp_payment_id
                        or payment_row.get("razorpay_payment_id"),
                        "payment_date": datetime.now(tz=UTC),
                    }
                },
            )
            return {
                "status": "captured",
                "payment_id": str(payment_row["id"]),
                "student_id": payment_row.get("student_id"),
            }

        if event_type == "payment.failed" and payment_row.get("status") != "PAID":
            self._db["fee_payments"].update_one(
                {"id": str(payment_row["id"])},
                {
                    "$set": {
                        "status": "FAILED",
                        "razorpay_payment_id": rp_payment_id
                        or payment_row.get("razorpay_payment_id"),
                    }
                },
            )
            return {"status": "failed", "payment_id": str(payment_row["id"])}

        return {"status": "recorded", "event": event_type}

    def record_admin_payment(
        self,
        actor: CurrentUser,
        *,
        student_id: str,
        month_year: str | None = None,
        status: str = "PAID",
        amount: float | Decimal | None = None,
        reference: str | None = None,
        payment_mode: str | None = None,
        received_by: str | None = None,
        remarks: str | None = None,
    ) -> dict[str, Any]:
        """Allow Super Admin and Restricted Fees Admin to record or edit fee payment records
        for any of the 12 months, logging all edits to Payment Correction History.
        """
        target_month = _validate_month_year(month_year)
        student = self._resolve_student(actor, student_id)
        student_uuid_str = str(student["id"])
        student_code = student.get("student_id") or ""
        course = student.get("course") or student.get("batch") or "GENERAL"
        norm_status = status.strip().upper()
        norm_mode = (payment_mode or "CASH").strip().upper()
        collector = (
            received_by.strip()
            if (received_by and received_by.strip())
            else (actor.identifier or "Admin Desk")
        )
        note = (remarks or "").strip()

        existing = self._db["fee_payments"].find_one(
            {
                "$or": [
                    {"student_key": student_uuid_str, "month_year": target_month},
                    *(
                        [{"student_id": student_code, "month_year": target_month}]
                        if student_code
                        else []
                    ),
                ]
            }
        )
        prev_status = existing.get("status", "UNPAID") if existing else "UNPAID"
        prev_amt = float(
            existing.get("amount", student.get("monthly_fee", 600))
            if existing
            else student.get("monthly_fee", 600)
        )

        if norm_status == "UNPAID":
            self._db["fee_payments"].delete_many(
                {
                    "$or": [
                        {"student_key": student_uuid_str, "month_year": target_month},
                        *(
                            [{"student_id": student_code, "month_year": target_month}]
                            if student_code
                            else []
                        ),
                    ]
                }
            )
            self._record_correction_log(
                actor=actor,
                student_name=student["name"],
                student_id=student_code or student_uuid_str[:8],
                month_year=target_month,
                previous_status=prev_status,
                new_status="UNPAID",
                previous_amount=prev_amt,
                new_amount=0.0,
                payment_mode=norm_mode,
                received_by=collector,
                remarks=note or "Marked as UNPAID",
            )
            return {
                "id": student_uuid_str,
                "student_key": student_uuid_str,
                "student_id": student_code,
                "student_name": student["name"],
                "course": course,
                "batch": course,
                "month": target_month,
                "month_year": target_month,
                "month_label": format_month_label(target_month),
                "status": "UNPAID",
                "payment_mode": norm_mode,
                "received_by": collector,
                "amount": float(student.get("monthly_fee", 600)),
            }

        if norm_status not in ("PAID", "PENDING", "FAILED"):
            raise ValidationError("Status must be PAID, PENDING, FAILED, or UNPAID.")

        fee_amt = float(
            Decimal(str(amount)).quantize(Decimal("0.01"))
            if amount is not None
            else Decimal(str(student.get("monthly_fee", 600))).quantize(
                Decimal("0.01")
            )
        )
        pay_ref = (
            reference
            or (existing.get("razorpay_payment_id") if existing else None)
            or f"{norm_mode}-{target_month}-{uuid4().hex[:6].upper()}"
        )
        now = datetime.now(tz=UTC) if norm_status == "PAID" else None

        row = self._db["fee_payments"].find_one_and_update(
            {"student_key": student_uuid_str, "month_year": target_month},
            {
                "$set": {
                    "student_key": student_uuid_str,
                    "student_id": student_code,
                    "student_name": student["name"],
                    "course": course,
                    "amount": fee_amt,
                    "status": norm_status,
                    "payment_mode": norm_mode,
                    "received_by": collector,
                    "remarks": note,
                    "razorpay_payment_id": pay_ref,
                    "payment_date": now,
                },
                "$setOnInsert": {
                    "id": str(uuid4()),
                    "month_year": target_month,
                    "razorpay_order_id": None,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        self._record_correction_log(
            actor=actor,
            student_name=student["name"],
            student_id=student_code or student_uuid_str[:8],
            month_year=target_month,
            previous_status=prev_status,
            new_status=norm_status,
            previous_amount=prev_amt,
            new_amount=fee_amt,
            payment_mode=norm_mode,
            received_by=collector,
            remarks=note or f"Recorded {norm_status} ({norm_mode})",
        )

        return _format_payment_row(
            dict(row), student_name=student["name"], course=course
        )

    def list_payment_corrections(self, limit: int = 100) -> list[dict[str, Any]]:
        rows = list(
            self._db["payment_corrections"]
            .find({}, {"_id": 0})
            .sort([("created_at", -1)])
            .limit(max(1, min(limit, 500)))
        )
        return rows

    def daily_collection_report(
        self, date_str: str | None = None
    ) -> dict[str, Any]:
        target_date = (
            date_str.strip()[:10]
            if (date_str and date_str.strip())
            else datetime.now(tz=UTC).strftime("%Y-%m-%d")
        )
        paid_rows = list(
            self._db["fee_payments"]
            .find({"status": "PAID"})
            .sort([("payment_date", -1)])
        )
        matched_items: list[dict[str, Any]] = []
        total_amt = Decimal("0.00")
        cash_amt = Decimal("0.00")
        online_amt = Decimal("0.00")

        for r in paid_rows:
            p_date = r.get("payment_date")
            p_str = (
                p_date.strftime("%Y-%m-%d")
                if isinstance(p_date, datetime)
                else str(p_date or "")[:10]
            )
            if p_str != target_date:
                continue
            formatted = _format_payment_row(dict(r))
            amt = Decimal(str(formatted["amount"])).quantize(Decimal("0.01"))
            total_amt += amt
            if formatted["payment_mode"] == "CASH":
                cash_amt += amt
            else:
                online_amt += amt
            matched_items.append(formatted)

        return {
            "date": target_date,
            "total_transactions": len(matched_items),
            "total_collected": float(total_amt),
            "cash_collected": float(cash_amt),
            "online_collected": float(online_amt),
            "items": matched_items,
        }

    def get_payment(self, actor: CurrentUser, payment_id: UUID) -> dict[str, Any]:
        row = self._db["fee_payments"].find_one({"id": str(payment_id)})
        if not row:
            raise NotFoundError("fee_payment", payment_id)

        student = None
        if row.get("student_key"):
            student = self._db["students"].find_one({"id": row["student_key"]})
        if not student and row.get("student_id"):
            student = self._db["students"].find_one({"student_id": row["student_id"]})
        if not student:
            raise NotFoundError(
                "student", row.get("student_id") or row.get("student_key")
            )

        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(student["id"])),
            student_id_code=student.get("student_id"),
        )
        return _format_payment_row(
            dict(row),
            student_name=student["name"],
            course=student.get("course") or student.get("batch"),
        )

    def list_payments(
        self,
        actor: CurrentUser,
        params: PageParams,
        *,
        student_id: str | UUID | None = None,
        status: str | None = None,
        month_year: str | None = None,
    ) -> Page[dict[str, Any]]:
        mongo_filter: dict[str, Any] = {}

        if not actor.is_admin:
            or_q: list[dict[str, Any]] = [{"student_key": str(actor.id)}]
            if actor.student_id:
                or_q.append({"student_id": actor.student_id})
            mongo_filter["$or"] = or_q
        elif student_id is not None:
            student = self._resolve_student(actor, student_id)
            or_q = [{"student_key": str(student["id"])}]
            if student.get("student_id"):
                or_q.append({"student_id": student["student_id"]})
            mongo_filter["$or"] = or_q

        if status and status.strip().upper() != "ALL":
            mongo_filter["status"] = status.strip().upper()

        if month_year and month_year.strip():
            mongo_filter["month_year"] = month_year.strip()

        total = self._db["fee_payments"].count_documents(mongo_filter)
        rows = list(
            self._db["fee_payments"]
            .find(mongo_filter)
            .sort([("payment_date", -1), ("month_year", -1)])
            .skip(params.offset)
            .limit(params.limit)
        )

        student_keys = list({r["student_key"] for r in rows if r.get("student_key")})
        student_codes = list({r["student_id"] for r in rows if r.get("student_id")})
        student_map_by_key: dict[str, dict[str, Any]] = {}
        student_map_by_code: dict[str, dict[str, Any]] = {}
        if student_keys or student_codes:
            or_s: list[dict[str, Any]] = []
            if student_keys:
                or_s.append({"id": {"$in": student_keys}})
            if student_codes:
                or_s.append({"student_id": {"$in": student_codes}})
            for s in self._db["students"].find({"$or": or_s}):
                student_map_by_key[str(s["id"])] = s
                if s.get("student_id"):
                    student_map_by_code[s["student_id"]] = s

        items = []
        for r in rows:
            s_doc = student_map_by_key.get(
                r.get("student_key", "")
            ) or student_map_by_code.get(r.get("student_id", ""), {})
            items.append(
                _format_payment_row(
                    dict(r),
                    student_name=s_doc.get("name") or r.get("student_name"),
                    course=s_doc.get("course")
                    or s_doc.get("batch")
                    or r.get("course"),
                )
            )
        return Page.of(items, total, params)

    def render_receipt_pdf(
        self, actor: CurrentUser, payment_id: UUID
    ) -> tuple[bytes, str]:
        row = self._db["fee_payments"].find_one({"id": str(payment_id)})
        if not row:
            raise NotFoundError("fee_payment", payment_id)

        student = None
        if row.get("student_key"):
            student = self._db["students"].find_one({"id": row["student_key"]})
        if not student and row.get("student_id"):
            student = self._db["students"].find_one({"student_id": row["student_id"]})
        if not student:
            raise NotFoundError(
                "student", row.get("student_id") or row.get("student_key")
            )

        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(student["id"])),
            student_id_code=student.get("student_id"),
        )

        course = student.get("course") or student.get("batch") or "GENERAL"
        code = student.get("student_id") or str(student["id"])[:8].upper()
        m_yr = row.get("month_year") or get_active_month()
        p_mode = row.get("payment_mode") or (
            "RAZORPAY"
            if str(row.get("razorpay_payment_id") or "").startswith("pay_")
            else "CASH"
        )
        received_by = row.get("received_by") or (
            "Online Razorpay Gateway" if p_mode != "CASH" else "Brightway Admin Desk"
        )
        txn_id = (
            row.get("razorpay_payment_id")
            or row.get("razorpay_order_id")
            or f"BW-{str(row['id'])[:8].upper()}"
        )

        pdf = FPDF(orientation="P", unit="mm", format="A5")
        pdf.add_page()
        pdf.set_fill_color(30, 58, 138)
        pdf.rect(0, 0, 148, 30, style="F")
        pdf.set_fill_color(245, 158, 11)
        pdf.rect(0, 30, 148, 2, style="F")

        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 12.5)
        pdf.set_xy(10, 7)
        pdf.cell(128, 6.5, "BRIGHTWAY COMPUTER EDUCATION", align="L")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(251, 191, 36)
        pdf.set_xy(10, 14)
        pdf.cell(
            128,
            5,
            "AFFILIATED TO RGYCSM (rgycsm.org)  |  OFFICIAL FEE RECEIPT",
            align="L",
        )
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(226, 232, 240)
        pdf.set_xy(10, 20)
        pdf.cell(
            128,
            5,
            "Verified Campus Location: https://share.google/ckM9UxaHIv8pXOjjd",
            align="L",
        )

        pdf.set_text_color(15, 23, 42)
        y = 38
        p_date = row.get("payment_date")
        details = [
            ("Receipt Number", f"BW-RCP-{str(row['id'])[:8].upper()}"),
            ("Student Name", str(student["name"])),
            ("Student ID", code),
            ("Course Name", str(course)),
            ("Contact Number", str(student.get("contact_number") or "-")),
            ("Payment Month", f"{format_month_label(m_yr)} ({m_yr})"),
            ("Payment Amount", f"INR {Decimal(str(row['amount'])):.2f}"),
            ("Payment Method", str(p_mode)),
            ("Transaction ID", str(txn_id)),
            ("Received By", str(received_by)),
            ("Payment Status", str(row["status"])),
            (
                "Payment Date",
                p_date.strftime("%d %b %Y, %I:%M %p")
                if isinstance(p_date, datetime)
                else str(p_date or datetime.now(tz=UTC).strftime("%d %b %Y")),
            ),
        ]
        for label, value in details:
            pdf.set_xy(12, y)
            pdf.set_font("Helvetica", "B", 8.5)
            pdf.set_text_color(100, 116, 139)
            pdf.cell(46, 6.5, label)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(15, 23, 42)
            pdf.cell(78, 6.5, value.encode("latin-1", "replace").decode("latin-1"))
            y += 7.8

        pdf.set_xy(12, y + 4)
        pdf.set_font("Helvetica", "I", 7.5)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(
            124,
            6,
            "Computer generated receipt verified by Brightway Computer Education.",
            align="C",
        )

        filename = f"Brightway-Receipt-{code}-{m_yr}.pdf"
        return bytes(pdf.output()), filename
