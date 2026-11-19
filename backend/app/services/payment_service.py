"""Server-side Razorpay Order Creation, Cryptographic Verification, and Monthly Fee Status Service (MongoDB Atlas).

Supports both online Razorpay payments and Admin one-click PAID/UNPAID toggles for any student
(by UUID `id` or `student_id`) for the active month (defaulting to December 2027, `2027-12`),
while preserving all historical months in the backend `fee_payments` collection.
"""

import json
import re
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fpdf import FPDF
from pymongo import ReturnDocument
from pymongo.database import Database as MongoDatabase

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
    return {
        "id": str(row["id"]),
        "student_key": row.get("student_key"),
        "student_id": row.get("student_id") or "",
        "student_name": student_name or row.get("student_name"),
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
        "status": row.get("status", "UNPAID"),
        "payment_date": p_iso,
        "paid_at": p_iso,
        "method": "RAZORPAY" if row.get("razorpay_payment_id") else "ADMIN",
    }


class PaymentService:
    def __init__(
        self,
        conn: MongoDatabase[dict[str, Any]],
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

        row = self._db["fee_payments"].find_one_and_update(
            {"student_key": student_uuid_str, "month_year": target_month},
            {
                "$set": {
                    "student_key": student_uuid_str,
                    "student_id": student.get("student_id") or "",
                    "amount": float(monthly_fee),
                    "razorpay_order_id": gw_order.id,
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
    ) -> dict[str, Any]:
        """Allow SUPER_ADMIN to record or toggle a fee payment status (PAID / UNPAID) in `fee_payments`."""
        target_month = _validate_month_year(month_year)
        student = self._resolve_student(actor, student_id)
        student_uuid_str = str(student["id"])
        student_code = student.get("student_id") or ""
        course = student.get("course") or student.get("batch") or "GENERAL"
        norm_status = status.strip().upper()

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
        pay_ref = reference or f"ADMIN-{target_month}"
        now = datetime.now(tz=UTC) if norm_status == "PAID" else None

        row = self._db["fee_payments"].find_one_and_update(
            {"student_key": student_uuid_str, "month_year": target_month},
            {
                "$set": {
                    "student_key": student_uuid_str,
                    "student_id": student_code,
                    "amount": fee_amt,
                    "status": norm_status,
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
        return _format_payment_row(
            dict(row), student_name=student["name"], course=course
        )

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
            raise NotFoundError("student", row.get("student_id") or row.get("student_key"))

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
            s_doc = student_map_by_key.get(r.get("student_key", "")) or student_map_by_code.get(
                r.get("student_id", ""), {}
            )
            items.append(
                _format_payment_row(
                    dict(r),
                    student_name=s_doc.get("name"),
                    course=s_doc.get("course") or s_doc.get("batch"),
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
            raise NotFoundError("student", row.get("student_id") or row.get("student_key"))

        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(student["id"])),
            student_id_code=student.get("student_id"),
        )

        course = student.get("course") or student.get("batch") or "GENERAL"
        code = student.get("student_id") or str(student["id"])[:8].upper()
        m_yr = row.get("month_year") or get_active_month()

        pdf = FPDF(orientation="P", unit="mm", format="A5")
        pdf.add_page()
        pdf.set_fill_color(30, 58, 138)
        pdf.rect(0, 0, 148, 28, style="F")
        pdf.set_fill_color(245, 158, 11)
        pdf.rect(0, 28, 148, 2, style="F")

        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_xy(10, 8)
        pdf.cell(128, 7, "BRIGHTWAY COMPUTER ACADEMY", align="L")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(251, 191, 36)
        pdf.set_xy(10, 16)
        pdf.cell(128, 6, "OFFICIAL FEE PAYMENT RECEIPT", align="L")

        pdf.set_text_color(15, 23, 42)
        y = 38
        p_date = row.get("payment_date")
        details = [
            ("Receipt ID", f"BW-RCP-{str(row['id'])[:8].upper()}"),
            ("Student Name", str(student["name"])),
            ("Student ID", code),
            ("Course", str(course)),
            ("Contact Number", str(student.get("contact_number") or "-")),
            ("Fee Month", f"{format_month_label(m_yr)} ({m_yr})"),
            ("Amount Paid", f"INR {Decimal(str(row['amount'])):.2f}"),
            ("Payment Status", str(row["status"])),
            (
                "Payment Reference",
                str(row.get("razorpay_payment_id") or "ADMIN-RECORDED"),
            ),
            (
                "Payment Date",
                p_date.strftime("%d %b %Y, %I:%M %p")
                if isinstance(p_date, datetime)
                else str(p_date or "-"),
            ),
        ]
        for label, value in details:
            pdf.set_xy(12, y)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(100, 116, 139)
            pdf.cell(48, 7, label)
            pdf.set_font("Helvetica", "B", 9.5)
            pdf.set_text_color(15, 23, 42)
            pdf.cell(76, 7, value.encode("latin-1", "replace").decode("latin-1"))
            y += 8.5

        filename = f"Brightway-Receipt-{code}-{m_yr}.pdf"
        return bytes(pdf.output()), filename
