"""Student profile, photo upload, active/inactive status, and 12-month fee ledger service.

Includes all Section 4 fields:
  - Student ID (`student_id`)
  - Student Name (`name`)
  - Father's/Mother's Name (`parent_name`)
  - Date of Birth (`dob`)
  - Contact Number (`contact_number`)
  - Address (`address`)
  - Course Name (`course` / `batch`)
  - Admission Date (`admission_date`)
  - Monthly Fee (`monthly_fee`)
  - Student Photograph (`photo_url`)
  - Active/Inactive Status (`active`: bool, `status`: 'ACTIVE' | 'INACTIVE')
"""

import base64
import io
import re
import time
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from PIL import Image, ImageDraw, ImageOps
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.constants import MONTH_NAMES, format_month_label, get_active_month
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.passwords import generate_student_passcode
from app.core.permissions import assert_student_self_or_staff
from app.core.security import CurrentUser
from app.integrations.storage import StorageProvider
from app.utils.pagination import Page, PageParams

MAX_PHOTO_BYTES = 2 * 1024 * 1024  # 2 MB strict limit
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/jpg", "image/png"}


def _try_uuid(val: str | UUID) -> UUID | None:
    if isinstance(val, UUID):
        return val
    try:
        return UUID(str(val))
    except ValueError:
        return None


def _validate_and_normalize_photo(raw: bytes, content_type: str | None) -> bytes:
    if not raw:
        raise ValidationError("Uploaded photo file is empty.")
    if len(raw) > MAX_PHOTO_BYTES:
        raise ValidationError("Photo exceeds the maximum allowed size of 2 MB.")
    if content_type and content_type.lower() not in ALLOWED_IMAGE_MIMES:
        raise ValidationError("Only PNG and JPEG images are allowed.")

    is_jpeg = raw[:3] == b"\xff\xd8\xff"
    is_png = raw[:8] == b"\x89PNG\r\n\x1a\n"
    if not (is_jpeg or is_png):
        raise ValidationError(
            "Invalid image file signature. Upload a valid PNG or JPEG photo."
        )

    try:
        with Image.open(io.BytesIO(raw)) as img:
            img_oriented = ImageOps.exif_transpose(img)
            rgb = img_oriented.convert("RGB")
            fitted = ImageOps.fit(rgb, (600, 720), method=Image.Resampling.LANCZOS)
            out = io.BytesIO()
            fitted.save(out, format="JPEG", quality=90, optimize=True)
            return out.getvalue()
    except Exception as exc:
        raise ValidationError(
            "Uploaded file could not be decoded as a valid image."
        ) from exc


def _render_fallback_avatar(name: str, student_id: str) -> bytes:
    img = Image.new("RGB", (400, 480), (30, 58, 138))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 420, 400, 480), fill=(245, 158, 11))
    initials = "".join(p[0] for p in (name or "BW").split()[:2] if p).upper() or "BW"
    draw.ellipse(
        (110, 90, 290, 270), fill=(37, 99, 235), outline=(251, 191, 36), width=5
    )
    draw.text((165, 155), initials, fill=(255, 255, 255))
    draw.text((135, 310), student_id or "UNASSIGNED", fill=(226, 232, 240))
    draw.text((105, 440), "BRIGHTWAY EDUCATION", fill=(15, 23, 42))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class StudentService:
    def __init__(
        self,
        conn: Any,
        storage: StorageProvider | None = None,
    ) -> None:
        self._db = conn
        self._storage = storage

    def _fetch_raw_student(self, identifier: str | UUID) -> dict[str, Any]:
        uid = _try_uuid(identifier)
        if uid is not None:
            row = self._db["students"].find_one({"id": str(uid)})
            if row:
                return dict(row)

        code = str(identifier).strip()
        if code:
            row = self._db["students"].find_one(
                {"student_id": code.upper()}
            ) or self._db["students"].find_one(
                {"student_id": {"$regex": f"^{re.escape(code)}$", "$options": "i"}}
            )
            if row:
                return dict(row)

        raise NotFoundError("student", identifier)

    def _set_month_payment_status(
        self,
        *,
        student_uuid_str: str,
        student_id_code: str,
        month_year: str,
        status: str,
        amount: float,
        payment_mode: str = "CASH",
        received_by: str = "Admin",
    ) -> None:
        norm_status = status.strip().upper()
        if norm_status == "PAID":
            self._db["fee_payments"].update_one(
                {"student_key": student_uuid_str, "month_year": month_year},
                {
                    "$set": {
                        "student_key": student_uuid_str,
                        "student_id": student_id_code,
                        "amount": amount,
                        "month_year": month_year,
                        "status": "PAID",
                        "payment_mode": payment_mode,
                        "received_by": received_by,
                        "payment_date": datetime.now(tz=UTC),
                    },
                    "$setOnInsert": {
                        "id": str(uuid4()),
                        "razorpay_order_id": None,
                        "razorpay_payment_id": f"{payment_mode}-{month_year}-{uuid4().hex[:6].upper()}",
                    },
                },
                upsert=True,
            )
        else:
            self._db["fee_payments"].delete_many(
                {
                    "$or": [
                        {"student_key": student_uuid_str, "month_year": month_year},
                        *(
                            [{"student_id": student_id_code, "month_year": month_year}]
                            if student_id_code
                            else []
                        ),
                    ]
                }
            )

    def _build_student_payload(
        self,
        row: dict[str, Any],
        *,
        include_payments: bool = True,
        active_month: str | None = None,
    ) -> dict[str, Any]:
        resolved_month = get_active_month(active_month)
        year_prefix = resolved_month.split("-")[0] if "-" in resolved_month else "2027"
        student_uuid_str = str(row["id"])
        student_code: str = row.get("student_id") or ""
        course: str = row.get("course") or row.get("batch") or "GENERAL"
        contact: str = row.get("contact_number") or ""
        parent_name: str = row.get("parent_name") or ""
        dob: str = row.get("dob") or ""
        address: str = row.get("address") or ""
        admission_date: str = str(row.get("admission_date") or "2027-01-01")[:10]
        is_active: bool = (
            bool(row["active"])
            if "active" in row and row["active"] is not None
            else (str(row.get("status", "ACTIVE")).upper() != "INACTIVE")
        )
        active_status_str = "ACTIVE" if is_active else "INACTIVE"

        monthly_fee = Decimal(str(row.get("monthly_fee", 600))).quantize(
            Decimal("0.01")
        )
        monthly_fee_float = float(monthly_fee)
        monthly_fee_paise = int(monthly_fee * 100)

        stored_password = row.get("password") or generate_student_passcode(
            row["name"], student_code, contact
        )

        payments_list: list[dict[str, Any]] = []
        payments_by_month: dict[str, dict[str, Any]] = {}

        if include_payments:
            or_clauses: list[dict[str, Any]] = [{"student_key": student_uuid_str}]
            if student_code:
                or_clauses.append({"student_id": student_code})

            payment_rows = list(
                self._db["fee_payments"]
                .find({"$or": or_clauses})
                .sort([("month_year", -1), ("payment_date", -1)])
            )

            for p in payment_rows:
                amt = Decimal(str(p.get("amount", monthly_fee))).quantize(
                    Decimal("0.01")
                )
                p_date = p.get("payment_date")
                p_mode = p.get("payment_mode") or (
                    "RAZORPAY"
                    if str(p.get("razorpay_payment_id") or "").startswith("pay_")
                    else "CASH"
                )
                p_dict = {
                    "id": str(p["id"]),
                    "student_id": student_code or p.get("student_id", ""),
                    "student_name": row["name"],
                    "course": course,
                    "amount": float(amt),
                    "amount_paise": int(amt * 100),
                    "month_year": p["month_year"],
                    "month_label": format_month_label(p["month_year"]),
                    "payment_mode": p_mode,
                    "method": p_mode,
                    "received_by": p.get("received_by") or "Online Razorpay",
                    "razorpay_order_id": p.get("razorpay_order_id"),
                    "razorpay_payment_id": p.get("razorpay_payment_id"),
                    "status": p["status"],
                    "payment_date": (
                        p_date.isoformat() if isinstance(p_date, datetime) else p_date
                    ),
                }
                payments_list.append(p_dict)
                payments_by_month[p["month_year"]] = p_dict

        active_payment = payments_by_month.get(resolved_month)
        current_month_status = (
            "PAID"
            if (active_payment and active_payment["status"] == "PAID")
            else "UNPAID"
        )

        # Build full 12-month ledger for the active year (Jan through Dec) + any extra paid months
        twelve_months = [f"{year_prefix}-{m:02d}" for m in range(1, 13)]
        all_months = list(
            dict.fromkeys([*twelve_months, *sorted(payments_by_month.keys())])
        )
        monthly_ledger: list[dict[str, Any]] = []
        for m_key in all_months:
            existing = payments_by_month.get(m_key)
            status_val = (
                "PAID" if (existing and existing["status"] == "PAID") else "UNPAID"
            )
            amt_val = existing["amount"] if existing else monthly_fee_float
            m_num = m_key.split("-")[1] if "-" in m_key else "12"
            monthly_ledger.append(
                {
                    "month_year": m_key,
                    "month_label": format_month_label(m_key),
                    "month_short": MONTH_NAMES.get(m_num, m_key)[:3],
                    "amount": amt_val,
                    "amount_paise": int(Decimal(str(amt_val)) * 100),
                    "status": status_val,
                    "is_current_month": m_key == resolved_month,
                    "payment_id": existing["id"] if existing else None,
                    "payment_mode": existing["payment_mode"] if existing else None,
                    "received_by": existing["received_by"] if existing else None,
                    "razorpay_order_id": (
                        existing["razorpay_order_id"] if existing else None
                    ),
                    "razorpay_payment_id": (
                        existing["razorpay_payment_id"] if existing else None
                    ),
                    "payment_date": existing["payment_date"] if existing else None,
                }
            )

        created_at = row.get("created_at")
        created_iso = (
            created_at.isoformat()
            if isinstance(created_at, datetime)
            else str(created_at or "")
        )

        return {
            "id": student_uuid_str,
            "name": row["name"],
            "full_name": row["name"],
            "student_id": student_code,
            "enrollment_number": student_code,
            "has_student_id": bool(student_code),
            "password": stored_password,
            "initial_passcode": stored_password,
            "parent_name": parent_name,
            "dob": dob,
            "contact_number": contact,
            "phone": contact,
            "address": address,
            "course": course,
            "batch": course,
            "batch_name": course,
            "admission_date": admission_date,
            "monthly_fee": monthly_fee_float,
            "monthly_fee_paise": monthly_fee_paise,
            "fee_status": current_month_status,
            "current_month_status": current_month_status,
            "month": resolved_month,
            "current_month": resolved_month,
            "month_label": format_month_label(resolved_month),
            "photo_url": row.get("photo_url"),
            "active": is_active,
            "status": active_status_str,
            "created_at": created_iso,
            "fee_payments": payments_list,
            "monthly_ledger": monthly_ledger,
        }

    def get(self, actor: CurrentUser, student_identifier: str | UUID) -> dict[str, Any]:
        row = self._fetch_raw_student(student_identifier)
        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(row["id"])),
            student_id_code=row.get("student_id"),
        )
        return self._build_student_payload(row, include_payments=True)

    def get_me(
        self, actor: CurrentUser, *, year: int | None = None
    ) -> dict[str, Any]:
        if actor.student_id:
            row = self._fetch_raw_student(actor.student_id)
        else:
            row = self._fetch_raw_student(actor.id)
        active_m = get_active_month()
        if year is not None:
            m_part = active_m.split("-")[1] if "-" in active_m else "12"
            active_m = f"{year}-{m_part}"
        return self._build_student_payload(
            row, include_payments=True, active_month=active_m
        )

    def list(
        self,
        params: PageParams,
        *,
        search: str | None = None,
        batch: str | None = None,
        course: str | None = None,
        fee_status: str | None = None,
        id_status: str | None = None,
        active_status: str | None = None,
        month_year: str | None = None,
    ) -> Page[dict[str, Any]]:
        resolved_month = get_active_month(month_year)
        and_conditions: list[dict[str, Any]] = []

        course_filter = course or batch
        if (
            course_filter
            and course_filter.strip()
            and course_filter.strip().upper() != "ALL"
        ):
            c_val = course_filter.strip()
            and_conditions.append({"$or": [{"course": c_val}, {"batch": c_val}]})

        if id_status and id_status.strip().upper() == "MISSING":
            and_conditions.append({"student_id": {"$in": ["", None]}})
        elif id_status and id_status.strip().upper() == "ASSIGNED":
            and_conditions.append({"student_id": {"$gt": ""}})

        if active_status and active_status.strip().upper() == "ACTIVE":
            and_conditions.append({"active": {"$ne": False}})
        elif active_status and active_status.strip().upper() == "INACTIVE":
            and_conditions.append({"active": False})

        if search and search.strip():
            rx = {"$regex": re.escape(search.strip()), "$options": "i"}
            and_conditions.append(
                {
                    "$or": [
                        {"name": rx},
                        {"student_id": rx},
                        {"contact_number": rx},
                        {"parent_name": rx},
                        {"address": rx},
                        {"course": rx},
                        {"batch": rx},
                        {"password": rx},
                    ]
                }
            )

        if fee_status and fee_status.strip().upper() in (
            "PAID",
            "UNPAID",
            "PENDING",
            "DUE",
        ):
            paid_docs = list(
                self._db["fee_payments"].find(
                    {"month_year": resolved_month, "status": "PAID"},
                    {"student_key": 1, "student_id": 1, "_id": 0},
                )
            )
            paid_keys = [d["student_key"] for d in paid_docs if d.get("student_key")]
            paid_codes = [d["student_id"] for d in paid_docs if d.get("student_id")]

            if fee_status.strip().upper() == "PAID":
                and_conditions.append(
                    {
                        "$or": [
                            {"id": {"$in": paid_keys}},
                            *(
                                [{"student_id": {"$in": paid_codes}}]
                                if paid_codes
                                else []
                            ),
                        ]
                    }
                )
            else:
                unpaid_cond: dict[str, Any] = {"id": {"$nin": paid_keys}}
                if paid_codes:
                    unpaid_cond["student_id"] = {"$nin": paid_codes}
                and_conditions.append(unpaid_cond)

        mongo_filter: dict[str, Any] = (
            {"$and": and_conditions}
            if len(and_conditions) > 1
            else (and_conditions[0] if and_conditions else {})
        )

        total = self._db["students"].count_documents(mongo_filter)
        rows = list(
            self._db["students"]
            .find(mongo_filter)
            .sort([("name", ASCENDING)])
            .skip(params.offset)
            .limit(params.limit)
        )

        student_keys = [str(r["id"]) for r in rows]
        student_codes = [r["student_id"] for r in rows if r.get("student_id")]
        active_payments_by_key: dict[str, dict[str, Any]] = {}
        active_payments_by_code: dict[str, dict[str, Any]] = {}

        if student_keys or student_codes:
            or_q: list[dict[str, Any]] = [{"student_key": {"$in": student_keys}}]
            if student_codes:
                or_q.append({"student_id": {"$in": student_codes}})
            for fp in self._db["fee_payments"].find(
                {"month_year": resolved_month, "$or": or_q}
            ):
                if fp.get("student_key"):
                    active_payments_by_key[fp["student_key"]] = fp
                if fp.get("student_id"):
                    active_payments_by_code[fp["student_id"]] = fp

        items: list[dict[str, Any]] = []
        for r in rows:
            s_uuid = str(r["id"])
            code = r.get("student_id") or ""
            contact = r.get("contact_number") or ""
            course_val = r.get("course") or r.get("batch") or "GENERAL"
            monthly_fee = Decimal(str(r.get("monthly_fee", 600))).quantize(
                Decimal("0.01")
            )
            pwd = r.get("password") or generate_student_passcode(
                r["name"], code, contact
            )
            created_at = r.get("created_at")
            is_active = (
                bool(r["active"])
                if "active" in r and r["active"] is not None
                else (str(r.get("status", "ACTIVE")).upper() != "INACTIVE")
            )

            fp = active_payments_by_key.get(s_uuid) or (
                active_payments_by_code.get(code) if code else None
            )
            p_date = fp.get("payment_date") if fp else None
            status_str = "PAID" if (fp and fp.get("status") == "PAID") else "UNPAID"

            items.append(
                {
                    "id": s_uuid,
                    "name": r["name"],
                    "full_name": r["name"],
                    "student_id": code,
                    "enrollment_number": code,
                    "has_student_id": bool(code),
                    "password": pwd,
                    "initial_passcode": pwd,
                    "parent_name": r.get("parent_name") or "",
                    "dob": r.get("dob") or "",
                    "contact_number": contact,
                    "phone": contact,
                    "address": r.get("address") or "",
                    "course": course_val,
                    "batch": course_val,
                    "batch_name": course_val,
                    "admission_date": str(r.get("admission_date") or "2027-01-01")[:10],
                    "monthly_fee": float(monthly_fee),
                    "monthly_fee_paise": int(monthly_fee * 100),
                    "fee_status": status_str,
                    "current_month_status": status_str,
                    "month": resolved_month,
                    "current_month": resolved_month,
                    "month_label": format_month_label(resolved_month),
                    "photo_url": r.get("photo_url"),
                    "active": is_active,
                    "status": "ACTIVE" if is_active else "INACTIVE",
                    "created_at": (
                        created_at.isoformat()
                        if isinstance(created_at, datetime)
                        else str(created_at or "")
                    ),
                    "active_payment_date": (
                        p_date.isoformat() if isinstance(p_date, datetime) else p_date
                    ),
                    "active_payment_mode": fp.get("payment_mode") if fp else None,
                    "active_received_by": fp.get("received_by") if fp else None,
                    "active_razorpay_payment_id": (
                        fp.get("razorpay_payment_id") if fp else None
                    ),
                }
            )

        return Page.of(items, total, params)

    def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name") or payload.get("full_name") or "").strip()
        if not name:
            raise ValidationError("Student name is required.")

        student_id = (
            str(payload.get("student_id") or payload.get("enrollment_number") or "")
            .strip()
            .upper()
        )
        parent_name = str(payload.get("parent_name") or "").strip()
        dob = str(payload.get("dob") or "").strip()
        contact = str(
            payload.get("contact_number") or payload.get("phone") or ""
        ).strip()
        address = str(payload.get("address") or "").strip()
        course = (
            str(payload.get("course") or payload.get("batch") or "GENERAL")
            .strip()
            .upper()
        )
        admission_date = str(
            payload.get("admission_date")
            or datetime.now(tz=UTC).strftime("%Y-%m-%d")
        ).strip()[:10]
        raw_fee = payload.get("monthly_fee", 600)
        monthly_fee = float(Decimal(str(raw_fee)).quantize(Decimal("0.01")))
        raw_password = str(payload.get("password") or "").strip()
        password = (
            raw_password
            if raw_password
            else generate_student_passcode(name, student_id, contact)
        )
        active_month = get_active_month(payload.get("month"))
        fee_status = str(payload.get("fee_status") or "UNPAID").strip().upper()
        if fee_status not in ("PAID", "UNPAID"):
            fee_status = "UNPAID"

        is_active = (
            bool(payload["active"])
            if "active" in payload and payload["active"] is not None
            else (str(payload.get("status", "ACTIVE")).upper() != "INACTIVE")
        )
        photo_url = payload.get("photo_data_url") or payload.get("photo_url")

        if student_id:
            dup = self._db["students"].find_one({"student_id": student_id})
            if dup:
                raise ConflictError(
                    f"Student ID '{student_id}' is already assigned to {dup['name']}."
                )

        new_uuid = str(uuid4())
        doc = {
            "id": new_uuid,
            "name": name,
            "student_id": student_id,
            "password": password,
            "parent_name": parent_name,
            "dob": dob,
            "contact_number": contact,
            "address": address,
            "course": course,
            "batch": course,
            "admission_date": admission_date,
            "monthly_fee": monthly_fee,
            "fee_status": fee_status,
            "month": active_month,
            "photo_url": photo_url,
            "active": is_active,
            "status": "ACTIVE" if is_active else "INACTIVE",
            "created_at": datetime.now(tz=UTC),
        }
        self._db["students"].insert_one(doc)

        if fee_status == "PAID":
            self._set_month_payment_status(
                student_uuid_str=new_uuid,
                student_id_code=student_id,
                month_year=active_month,
                status="PAID",
                amount=monthly_fee,
            )

        return self._build_student_payload(
            doc, include_payments=True, active_month=active_month
        )

    def update(
        self, student_identifier: str | UUID, payload: dict[str, Any]
    ) -> dict[str, Any]:
        existing = self._fetch_raw_student(student_identifier)
        student_uuid_str = str(existing["id"])
        old_student_id = existing.get("student_id") or ""

        name = str(
            payload.get("name") or payload.get("full_name") or existing["name"]
        ).strip()

        if "student_id" in payload or "enrollment_number" in payload:
            raw_new_id = (
                payload.get("student_id")
                if "student_id" in payload
                else payload.get("enrollment_number")
            )
            new_student_id = str(raw_new_id or "").strip().upper()
        else:
            new_student_id = old_student_id

        if new_student_id and new_student_id != old_student_id:
            dup = self._db["students"].find_one(
                {"student_id": new_student_id, "id": {"$ne": student_uuid_str}}
            )
            if dup:
                raise ConflictError(
                    f"Student ID '{new_student_id}' is already assigned to {dup['name']}."
                )

        parent_name = (
            str(payload.get("parent_name") or "").strip()
            if "parent_name" in payload
            else (existing.get("parent_name") or "")
        )
        dob = (
            str(payload.get("dob") or "").strip()
            if "dob" in payload
            else (existing.get("dob") or "")
        )
        address = (
            str(payload.get("address") or "").strip()
            if "address" in payload
            else (existing.get("address") or "")
        )
        admission_date = (
            str(payload.get("admission_date") or "2027-01-01").strip()[:10]
            if "admission_date" in payload
            else str(existing.get("admission_date") or "2027-01-01")[:10]
        )

        if "contact_number" in payload or "phone" in payload:
            raw_contact = (
                payload.get("contact_number")
                if "contact_number" in payload
                else payload.get("phone")
            )
            contact = str(raw_contact or "").strip()
        else:
            contact = existing.get("contact_number") or ""

        if "course" in payload or "batch" in payload:
            raw_course = (
                payload.get("course")
                if "course" in payload
                else payload.get("batch")
            )
            course = str(raw_course or "GENERAL").strip().upper()
        else:
            course = existing.get("course") or existing.get("batch") or "GENERAL"

        raw_fee = payload.get("monthly_fee", existing.get("monthly_fee", 600))
        monthly_fee = float(Decimal(str(raw_fee)).quantize(Decimal("0.01")))

        existing_active = (
            bool(existing["active"])
            if "active" in existing and existing["active"] is not None
            else (str(existing.get("status", "ACTIVE")).upper() != "INACTIVE")
        )
        if "active" in payload and payload["active"] is not None:
            is_active = bool(payload["active"])
        elif "status" in payload and payload["status"] is not None:
            is_active = str(payload["status"]).strip().upper() != "INACTIVE"
        else:
            is_active = existing_active

        photo_url = existing.get("photo_url")
        if payload.get("photo_data_url") or payload.get("photo_url"):
            photo_url = payload.get("photo_data_url") or payload.get("photo_url")

        existing_pwd = existing.get("password") or ""
        if "password" in payload and str(payload.get("password") or "").strip():
            req_pwd = str(payload["password"]).strip()
            if (
                req_pwd == existing_pwd
                and new_student_id
                and new_student_id != old_student_id
            ):
                password = generate_student_passcode(name, new_student_id, contact)
            else:
                password = req_pwd
        elif new_student_id and new_student_id != old_student_id:
            password = generate_student_passcode(name, new_student_id, contact)
        else:
            password = existing_pwd or generate_student_passcode(
                name, new_student_id, contact
            )

        active_month = get_active_month(payload.get("month"))

        try:
            row = self._db["students"].find_one_and_update(
                {"id": student_uuid_str},
                {
                    "$set": {
                        "name": name,
                        "student_id": new_student_id,
                        "password": password,
                        "parent_name": parent_name,
                        "dob": dob,
                        "contact_number": contact,
                        "address": address,
                        "course": course,
                        "batch": course,
                        "admission_date": admission_date,
                        "monthly_fee": monthly_fee,
                        "month": active_month,
                        "photo_url": photo_url,
                        "active": is_active,
                        "status": "ACTIVE" if is_active else "INACTIVE",
                    }
                },
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as exc:
            raise ConflictError(
                f"Student ID '{new_student_id}' is already in use."
            ) from exc

        if new_student_id != old_student_id:
            self._db["fee_payments"].update_many(
                {
                    "$or": [
                        {"student_key": student_uuid_str},
                        *(
                            [{"student_id": old_student_id}]
                            if old_student_id
                            else []
                        ),
                    ]
                },
                {
                    "$set": {
                        "student_key": student_uuid_str,
                        "student_id": new_student_id,
                    }
                },
            )

        if "fee_status" in payload and payload["fee_status"] is not None:
            self._set_month_payment_status(
                student_uuid_str=student_uuid_str,
                student_id_code=new_student_id,
                month_year=active_month,
                status=str(payload["fee_status"]),
                amount=monthly_fee,
            )

        return self._build_student_payload(
            dict(row), include_payments=True, active_month=active_month
        )

    def delete(self, student_identifier: str | UUID) -> dict[str, Any]:
        existing = self._fetch_raw_student(student_identifier)
        s_uuid = str(existing["id"])
        code = existing.get("student_id") or ""
        self._db["students"].delete_one({"id": s_uuid})
        self._db["fee_payments"].delete_many(
            {
                "$or": [
                    {"student_key": s_uuid},
                    *([{"student_id": code}] if code else []),
                ]
            }
        )
        return {"deleted": True, "id": s_uuid, "student_id": code}

    def upload_photo(
        self,
        actor: CurrentUser,
        student_identifier: str | UUID,
        *,
        filename: str,
        content_type: str | None,
        data: bytes,
    ) -> dict[str, Any]:
        row = self._fetch_raw_student(student_identifier)
        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(row["id"])),
            student_id_code=row.get("student_id"),
        )
        normalized_jpeg = _validate_and_normalize_photo(data, content_type)
        ref_id = row.get("student_id") or str(row["id"])
        safe_code = re.sub(r"[^A-Za-z0-9_-]", "_", ref_id)
        storage_key = f"{safe_code}.jpg"

        if self._storage is not None:
            self._storage.put(
                bucket="student-photos",
                key=storage_key,
                data=normalized_jpeg,
                content_type="image/jpeg",
            )

        b64_jpeg = base64.b64encode(normalized_jpeg).decode("ascii")
        photo_url = f"/api/v1/students/{ref_id}/photo?v={int(time.time())}"
        updated = self._db["students"].find_one_and_update(
            {"id": str(row["id"])},
            {
                "$set": {
                    "photo_url": photo_url,
                    "photo_b64": b64_jpeg,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._build_student_payload(dict(updated), include_payments=True)

    def get_photo_bytes(self, student_identifier: str | UUID) -> tuple[bytes, str]:
        row = self._fetch_raw_student(student_identifier)
        if row.get("photo_b64"):
            try:
                return base64.b64decode(row["photo_b64"]), "image/jpeg"
            except Exception:
                pass
        if isinstance(row.get("photo_url"), str) and row["photo_url"].startswith(
            "data:image/"
        ):
            try:
                _, b64_part = row["photo_url"].split(",", 1)
                return base64.b64decode(b64_part), "image/jpeg"
            except Exception:
                pass

        ref_id = row.get("student_id") or str(row["id"])
        safe_code = re.sub(r"[^A-Za-z0-9_-]", "_", ref_id)
        storage_key = f"{safe_code}.jpg"

        if self._storage is not None:
            try:
                raw_bytes = self._storage.get(bucket="student-photos", key=storage_key)
                return raw_bytes, "image/jpeg"
            except Exception:
                pass

        return (
            _render_fallback_avatar(row["name"], row.get("student_id") or ""),
            "image/png",
        )
