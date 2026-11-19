"""Student profile, photo upload, admin inline editing, and active-month fee status service (MongoDB Atlas).

Canonical Student Schema:
  NAME (`name`)
  STUDENT ID (`student_id` - can be assigned/edited by Admin if blank in CSV)
  PASSWORD (`password` - stored & editable by Admin)
  CONTACT NO. (`contact_number`)
  COURSE (`course` / `batch`)
  FEES (`monthly_fee` & `fee_status`: PAID | UNPAID)
  MONTH (`month` - e.g. '2027-12' / 'December 2027')
"""

import io
import re
import time
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from PIL import Image, ImageDraw, ImageOps
from pymongo import ASCENDING, ReturnDocument
from pymongo.database import Database as MongoDatabase
from pymongo.errors import DuplicateKeyError

from app.core.constants import format_month_label, get_active_month
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
    draw.text((115, 440), "BRIGHTWAY ACADEMY", fill=(15, 23, 42))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class StudentService:
    def __init__(
        self,
        conn: MongoDatabase[dict[str, Any]],
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
                        "payment_date": datetime.now(tz=UTC),
                    },
                    "$setOnInsert": {
                        "id": str(uuid4()),
                        "razorpay_order_id": None,
                        "razorpay_payment_id": f"ADMIN-{month_year}",
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
        student_uuid_str = str(row["id"])
        student_code: str = row.get("student_id") or ""
        course: str = row.get("course") or row.get("batch") or "GENERAL"
        contact: str = row.get("contact_number") or ""
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
                p_dict = {
                    "id": str(p["id"]),
                    "student_id": student_code or p.get("student_id", ""),
                    "amount": float(amt),
                    "amount_paise": int(amt * 100),
                    "month_year": p["month_year"],
                    "month_label": format_month_label(p["month_year"]),
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

        # Build clean ledger starting from active month + any historical months stored in backend
        all_months = sorted(
            {resolved_month, *payments_by_month.keys()}, reverse=True
        )
        monthly_ledger: list[dict[str, Any]] = []
        for m_key in all_months:
            existing = payments_by_month.get(m_key)
            status_val = (
                "PAID" if (existing and existing["status"] == "PAID") else "UNPAID"
            )
            amt_val = existing["amount"] if existing else monthly_fee_float
            monthly_ledger.append(
                {
                    "month_year": m_key,
                    "month_label": format_month_label(m_key),
                    "month_short": format_month_label(m_key)[:3],
                    "amount": amt_val,
                    "amount_paise": int(Decimal(str(amt_val)) * 100),
                    "status": status_val,
                    "is_current_month": m_key == resolved_month,
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
            "contact_number": contact,
            "phone": contact,
            "course": course,
            "batch": course,
            "batch_name": course,
            "monthly_fee": monthly_fee_float,
            "monthly_fee_paise": monthly_fee_paise,
            "fee_status": current_month_status,
            "current_month_status": current_month_status,
            "month": resolved_month,
            "current_month": resolved_month,
            "month_label": format_month_label(resolved_month),
            "photo_url": row.get("photo_url"),
            "created_at": created_iso,
            "active": True,
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

    def get_me(self, actor: CurrentUser) -> dict[str, Any]:
        if actor.student_id:
            row = self._fetch_raw_student(actor.student_id)
        else:
            row = self._fetch_raw_student(actor.id)
        return self._build_student_payload(row, include_payments=True)

    def list(
        self,
        params: PageParams,
        *,
        search: str | None = None,
        batch: str | None = None,
        course: str | None = None,
        fee_status: str | None = None,
        id_status: str | None = None,
        month_year: str | None = None,
    ) -> Page[dict[str, Any]]:
        resolved_month = get_active_month(month_year)
        mongo_filter: dict[str, Any] = {}

        course_filter = course or batch
        if (
            course_filter
            and course_filter.strip()
            and course_filter.strip().upper() != "ALL"
        ):
            c_val = course_filter.strip()
            mongo_filter["$or"] = [{"course": c_val}, {"batch": c_val}]

        if id_status and id_status.strip().upper() == "MISSING":
            mongo_filter["student_id"] = {"$in": ["", None]}
        elif id_status and id_status.strip().upper() == "ASSIGNED":
            mongo_filter["student_id"] = {"$gt": ""}

        if search and search.strip():
            rx = {"$regex": re.escape(search.strip()), "$options": "i"}
            search_or = [
                {"name": rx},
                {"student_id": rx},
                {"contact_number": rx},
                {"course": rx},
                {"batch": rx},
                {"password": rx},
            ]
            if "$or" in mongo_filter:
                mongo_filter = {
                    "$and": [{"$or": mongo_filter.pop("$or")}, {"$or": search_or}],
                    **mongo_filter,
                }
            else:
                mongo_filter["$or"] = search_or

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
                paid_cond = {
                    "$or": [
                        {"id": {"$in": paid_keys}},
                        *(
                            [{"student_id": {"$in": paid_codes}}]
                            if paid_codes
                            else []
                        ),
                    ]
                }
                mongo_filter = (
                    {"$and": [mongo_filter, paid_cond]} if mongo_filter else paid_cond
                )
            else:
                unpaid_cond: dict[str, Any] = {"id": {"$nin": paid_keys}}
                if paid_codes:
                    unpaid_cond["student_id"] = {"$nin": paid_codes}
                mongo_filter = (
                    {"$and": [mongo_filter, unpaid_cond]}
                    if mongo_filter
                    else unpaid_cond
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
                    "contact_number": contact,
                    "phone": contact,
                    "course": course_val,
                    "batch": course_val,
                    "batch_name": course_val,
                    "monthly_fee": float(monthly_fee),
                    "monthly_fee_paise": int(monthly_fee * 100),
                    "fee_status": status_str,
                    "current_month_status": status_str,
                    "month": resolved_month,
                    "current_month": resolved_month,
                    "month_label": format_month_label(resolved_month),
                    "photo_url": r.get("photo_url"),
                    "created_at": (
                        created_at.isoformat()
                        if isinstance(created_at, datetime)
                        else str(created_at or "")
                    ),
                    "active": True,
                    "active_payment_date": (
                        p_date.isoformat() if isinstance(p_date, datetime) else p_date
                    ),
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
        contact = str(
            payload.get("contact_number") or payload.get("phone") or ""
        ).strip()
        course = (
            str(payload.get("course") or payload.get("batch") or "GENERAL")
            .strip()
            .upper()
        )
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
            "contact_number": contact,
            "course": course,
            "batch": course,
            "monthly_fee": monthly_fee,
            "fee_status": fee_status,
            "month": active_month,
            "photo_url": None,
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

        # Password resolution: if Admin explicitly changed password, use it;
        # if Admin assigned a new student_id and didn't change password, auto-derive from new student_id
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
                        "contact_number": contact,
                        "course": course,
                        "batch": course,
                        "monthly_fee": monthly_fee,
                        "month": active_month,
                    }
                },
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as exc:
            raise ConflictError(
                f"Student ID '{new_student_id}' is already in use."
            ) from exc

        # Cascade student_id update to fee_payments if student_id changed
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

        # If fee_status was included in the update payload, sync active month payment status
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

        photo_url = f"/api/v1/students/{ref_id}/photo?v={int(time.time())}"
        updated = self._db["students"].find_one_and_update(
            {"id": str(row["id"])},
            {"$set": {"photo_url": photo_url}},
            return_document=ReturnDocument.AFTER,
        )
        return self._build_student_payload(dict(updated), include_payments=True)

    def get_photo_bytes(self, student_identifier: str | UUID) -> tuple[bytes, str]:
        row = self._fetch_raw_student(student_identifier)
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
