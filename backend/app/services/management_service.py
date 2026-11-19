"""Comprehensive Institute Management Service for Brightway Computer Education:
1. Three-Level Admin Account Management (Super Admin vs. Restricted Admin)
2. Password-Protected Cash Flow Management (Super Admin Only - Income, Expenses, Daily/Monthly/Yearly Balance)
3. Online Admission Form Submission & Super Admin Approval Workflow
4. Year-Wise Student Photo Album Management
5. System ON/OFF Controls, Activity Audit Logs, Payment Correction History & Database Backups
"""

import re
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from pymongo import ASCENDING, ReturnDocument

from app.core.constants import Role, format_month_label, get_active_month
from app.core.errors import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from app.core.passwords import (
    generate_student_passcode,
    hash_password,
    verify_password,
)
from app.core.permissions import assert_super_admin
from app.core.security import CurrentUser

DEFAULT_CASHFLOW_PASSWORD = "Brightway@Cash2026!"

DEFAULT_SYSTEM_SETTINGS: dict[str, Any] = {
    "key": "global",
    "online_admissions_enabled": True,
    "online_fee_payment_enabled": True,
    "student_id_download_enabled": True,
    "photo_albums_visible_to_students": True,
    "fee_reminders_enabled": True,
    "maintenance_mode_enabled": False,
    "institute_name": "BRIGHTWAY COMPUTER EDUCATION",
    "institute_affiliation": "Affiliated to RGYCSM (Rajiv Gandhi Youth Computer Saksharta Mission)",
    "institute_address": "Brightway Computer Education Campus, West Bengal (Google Maps Verified)",
    "institute_map_url": "https://share.google/ckM9UxaHIv8pXOjjd",
    "institute_courses_url": "https://www.rgycsm.org/courses",
    "active_session": "2027-2028",
}


class ManagementService:
    def __init__(self, db: Any) -> None:
        self._db = db

    # -------------------------------------------------------------------------
    # Activity Audit Log
    # -------------------------------------------------------------------------
    def log_activity(
        self,
        actor: CurrentUser | None,
        action: str,
        target: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        doc = {
            "id": str(uuid4()),
            "actor_id": str(actor.id) if actor else "PUBLIC",
            "actor_name": (actor.identifier or actor.full_name or "System")
            if actor
            else "Public Applicant",
            "actor_role": actor.role.value if actor else "PUBLIC",
            "action": action,
            "target": target,
            "details": details or {},
            "created_at": datetime.now(tz=UTC).isoformat(),
        }
        self._db["activity_logs"].insert_one(doc)

    def list_activity_logs(self, limit: int = 100) -> list[dict[str, Any]]:
        rows = list(
            self._db["activity_logs"]
            .find({}, {"_id": 0})
            .sort([("created_at", -1)])
            .limit(max(1, min(limit, 500)))
        )
        return rows

    # -------------------------------------------------------------------------
    # System ON/OFF Settings
    # -------------------------------------------------------------------------
    def get_system_settings(self) -> dict[str, Any]:
        doc = self._db["system_settings"].find_one({"key": "global"})
        if not doc:
            doc = {
                **DEFAULT_SYSTEM_SETTINGS,
                "cashflow_password_hash": hash_password(DEFAULT_CASHFLOW_PASSWORD),
                "updated_at": datetime.now(tz=UTC).isoformat(),
            }
            self._db["system_settings"].insert_one(doc)
        out = {**DEFAULT_SYSTEM_SETTINGS, **doc}
        out.pop("_id", None)
        out.pop("cashflow_password_hash", None)
        return out

    def update_system_settings(
        self, actor: CurrentUser, payload: dict[str, Any]
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        current = self._db["system_settings"].find_one({"key": "global"}) or {
            **DEFAULT_SYSTEM_SETTINGS
        }
        updates: dict[str, Any] = {}
        bool_keys = [
            "online_admissions_enabled",
            "online_fee_payment_enabled",
            "student_id_download_enabled",
            "photo_albums_visible_to_students",
            "fee_reminders_enabled",
            "maintenance_mode_enabled",
        ]
        for k in bool_keys:
            if k in payload and payload[k] is not None:
                updates[k] = bool(payload[k])

        str_keys = [
            "institute_name",
            "institute_affiliation",
            "institute_address",
            "active_session",
        ]
        for k in str_keys:
            if k in payload and payload[k] is not None:
                updates[k] = str(payload[k]).strip()

        if payload.get("new_cashflow_password"):
            new_cf_pwd = str(payload["new_cashflow_password"]).strip()
            if len(new_cf_pwd) < 4:
                raise ValidationError(
                    "Cash Flow password must be at least 4 characters."
                )
            updates["cashflow_password_hash"] = hash_password(new_cf_pwd)

        updates["updated_at"] = datetime.now(tz=UTC).isoformat()
        self._db["system_settings"].update_one(
            {"key": "global"},
            {"$set": {**DEFAULT_SYSTEM_SETTINGS, **current, **updates}},
            upsert=True,
        )
        self.log_activity(actor, "UPDATE_SYSTEM_SETTINGS", "global", updates)
        return self.get_system_settings()

    # -------------------------------------------------------------------------
    # Admin Account Management (Super Admin vs. Restricted Fees Admin)
    # -------------------------------------------------------------------------
    def list_admins(self, actor: CurrentUser) -> list[dict[str, Any]]:
        assert_super_admin(actor)
        rows = list(
            self._db["admins"]
            .find({}, {"_id": 0, "password_hash": 0})
            .sort([("username", ASCENDING)])
        )
        return [
            {
                "id": str(r["id"]),
                "username": r["username"],
                "role": r.get("role", "ADMIN"),
                "display_name": r.get("display_name")
                or (
                    "Super Administrator"
                    if r.get("role") == "SUPER_ADMIN"
                    else "Fees Management Admin"
                ),
                "created_at": (
                    r["created_at"].isoformat()
                    if isinstance(r.get("created_at"), datetime)
                    else str(r.get("created_at") or "")
                ),
            }
            for r in rows
        ]

    def create_admin(
        self, actor: CurrentUser, payload: dict[str, Any]
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        username = str(payload.get("username") or "").strip().upper()
        password = str(payload.get("password") or "").strip()
        role_str = str(payload.get("role") or "ADMIN").strip().upper()
        display_name = str(
            payload.get("display_name")
            or (
                "Super Administrator"
                if role_str == "SUPER_ADMIN"
                else "Fees Management Admin"
            )
        ).strip()

        if not username or len(username) < 3:
            raise ValidationError("Admin username must be at least 3 characters.")
        if not password or len(password) < 6:
            raise ValidationError("Admin password must be at least 6 characters.")
        if role_str not in (Role.SUPER_ADMIN.value, Role.ADMIN.value):
            raise ValidationError("Role must be SUPER_ADMIN or ADMIN.")

        existing = self._db["admins"].find_one(
            {"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}
        )
        if existing:
            raise ConflictError(f"Admin username '{username}' already exists.")

        new_doc = {
            "id": str(uuid4()),
            "username": username,
            "password_hash": hash_password(password),
            "role": role_str,
            "display_name": display_name,
            "created_at": datetime.now(tz=UTC),
        }
        self._db["admins"].insert_one(new_doc)
        self.log_activity(
            actor, "CREATE_ADMIN", username, {"role": role_str, "display_name": display_name}
        )
        return {
            "id": new_doc["id"],
            "username": new_doc["username"],
            "role": new_doc["role"],
            "display_name": new_doc["display_name"],
            "created_at": new_doc["created_at"].isoformat(),
        }

    def delete_admin(self, actor: CurrentUser, admin_id: str) -> dict[str, Any]:
        assert_super_admin(actor)
        target = self._db["admins"].find_one({"id": admin_id})
        if not target:
            raise NotFoundError("admin", admin_id)
        if target["username"].upper() == "BWADMIN" or str(target["id"]) == str(actor.id):
            raise ValidationError(
                "Primary Super Admin account (BWADMIN) or your own active account cannot be deleted."
            )
        self._db["admins"].delete_one({"id": admin_id})
        self.log_activity(actor, "DELETE_ADMIN", target["username"])
        return {"deleted": True, "id": admin_id, "username": target["username"]}

    # -------------------------------------------------------------------------
    # Cash Flow Management — SUPER_ADMIN ONLY (3-Tier RBAC, No Secondary Lock)
    # -------------------------------------------------------------------------
    def verify_cashflow_access(
        self, actor: CurrentUser, supplied_password: str | None = None
    ) -> dict[str, bool]:
        """Strictly require Role.SUPER_ADMIN (3-tier RBAC without secondary lock)."""
        assert_super_admin(actor)
        return {"unlocked": True}

    def get_cashflow_dashboard(
        self,
        actor: CurrentUser,
        cashflow_password: str | None = None,
        *,
        year: int = 2026,
        month_year: str | None = None,
        date_str: str | None = None,
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        target_month = get_active_month(month_year)
        target_date = (
            date_str.strip()
            if (date_str and date_str.strip())
            else datetime.now(tz=UTC).strftime("%Y-%m-%d")
        )
        year_prefix = f"{year}-"

        # 1. All PAID fee payments (Income)
        paid_fps = list(self._db["fee_payments"].find({"status": "PAID"}))
        # 2. All recorded expenses
        all_expenses = list(
            self._db["expenses"].find({}, {"_id": 0}).sort([("expense_date", -1)])
        )

        total_income = Decimal("0.00")
        total_cash_received = Decimal("0.00")
        total_online_received = Decimal("0.00")

        daily_income = Decimal("0.00")
        monthly_income = Decimal("0.00")
        yearly_income = Decimal("0.00")

        monthly_cash = Decimal("0.00")
        monthly_online = Decimal("0.00")

        twelve_months_flow: dict[str, dict[str, float]] = {
            f"{year}-{m:02d}": {
                "month_year": f"{year}-{m:02d}",
                "month_label": format_month_label(f"{year}-{m:02d}"),
                "income": 0.0,
                "cash_income": 0.0,
                "online_income": 0.0,
                "expenses": 0.0,
                "balance": 0.0,
            }
            for m in range(1, 13)
        }

        for fp in paid_fps:
            amt = Decimal(str(fp.get("amount", 0))).quantize(Decimal("0.01"))
            m_yr = str(fp.get("month_year") or "")
            mode = str(fp.get("payment_mode") or "").upper()
            if not mode:
                ref = str(fp.get("razorpay_payment_id") or "")
                mode = (
                    "CASH"
                    if ref.startswith(("CASH", "ADMIN", "OFFLINE"))
                    else "ONLINE"
                )
            is_cash = mode == "CASH"

            p_date = fp.get("payment_date")
            p_date_str = (
                p_date.strftime("%Y-%m-%d")
                if isinstance(p_date, datetime)
                else str(p_date or "")[:10]
            )

            total_income += amt
            if is_cash:
                total_cash_received += amt
            else:
                total_online_received += amt

            if p_date_str == target_date:
                daily_income += amt

            if m_yr == target_month:
                monthly_income += amt
                if is_cash:
                    monthly_cash += amt
                else:
                    monthly_online += amt

            if m_yr.startswith(year_prefix):
                yearly_income += amt
                if m_yr in twelve_months_flow:
                    twelve_months_flow[m_yr]["income"] = round(
                        twelve_months_flow[m_yr]["income"] + float(amt), 2
                    )
                    if is_cash:
                        twelve_months_flow[m_yr]["cash_income"] = round(
                            twelve_months_flow[m_yr]["cash_income"] + float(amt), 2
                        )
                    else:
                        twelve_months_flow[m_yr]["online_income"] = round(
                            twelve_months_flow[m_yr]["online_income"] + float(amt), 2
                        )

        total_expenses = Decimal("0.00")
        daily_expenses = Decimal("0.00")
        monthly_expenses = Decimal("0.00")
        yearly_expenses = Decimal("0.00")

        for exp in all_expenses:
            amt = Decimal(str(exp.get("amount", 0))).quantize(Decimal("0.01"))
            e_date = str(exp.get("expense_date") or "")[:10]
            e_month = e_date[:7]

            total_expenses += amt
            if e_date == target_date:
                daily_expenses += amt
            if e_month == target_month:
                monthly_expenses += amt
            if e_date.startswith(year_prefix):
                yearly_expenses += amt
                if e_month in twelve_months_flow:
                    twelve_months_flow[e_month]["expenses"] = round(
                        twelve_months_flow[e_month]["expenses"] + float(amt), 2
                    )

        for m_entry in twelve_months_flow.values():
            m_entry["balance"] = round(m_entry["income"] - m_entry["expenses"], 2)

        return {
            "year": year,
            "active_month": target_month,
            "active_month_label": format_month_label(target_month),
            "target_date": target_date,
            "total_income": float(total_income),
            "total_expenses": float(total_expenses),
            "total_balance": float(total_income - total_expenses),
            "total_cash_received": float(total_cash_received),
            "total_online_received": float(total_online_received),
            "daily": {
                "date": target_date,
                "income": float(daily_income),
                "expenses": float(daily_expenses),
                "balance": float(daily_income - daily_expenses),
            },
            "monthly": {
                "month_year": target_month,
                "month_label": format_month_label(target_month),
                "income": float(monthly_income),
                "cash_received": float(monthly_cash),
                "online_received": float(monthly_online),
                "expenses": float(monthly_expenses),
                "balance": float(monthly_income - monthly_expenses),
            },
            "yearly": {
                "year": year,
                "income": float(yearly_income),
                "expenses": float(yearly_expenses),
                "balance": float(yearly_income - yearly_expenses),
            },
            "monthly_breakdown": list(twelve_months_flow.values()),
            "expenses": all_expenses[:200],
        }

    def add_expense(
        self,
        actor: CurrentUser,
        cashflow_password: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        payload = payload or {}
        description = str(
            payload.get("description") or payload.get("title") or ""
        ).strip()
        if not description:
            raise ValidationError("Expense description is required.")

        raw_amount = payload.get("amount", 0)
        amount = float(Decimal(str(raw_amount)).quantize(Decimal("0.01")))
        if amount <= 0:
            raise ValidationError("Expense amount must be greater than zero.")

        category = str(payload.get("category") or "INSTITUTE_EXPENSE").strip().upper()
        payment_mode = str(payload.get("payment_mode") or "CASH").strip().upper()
        expense_date = str(
            payload.get("expense_date")
            or datetime.now(tz=UTC).strftime("%Y-%m-%d")
        ).strip()[:10]

        doc = {
            "id": str(uuid4()),
            "description": description,
            "category": category,
            "amount": amount,
            "payment_mode": payment_mode,
            "expense_date": expense_date,
            "recorded_by": actor.identifier or "BWADMIN",
            "created_at": datetime.now(tz=UTC).isoformat(),
        }
        self._db["expenses"].insert_one(doc)
        doc.pop("_id", None)
        self.log_activity(actor, "ADD_EXPENSE", description, {"amount": amount})
        return doc

    def delete_expense(
        self,
        actor: CurrentUser,
        cashflow_password: str | None = None,
        expense_id: str = "",
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        existing = self._db["expenses"].find_one({"id": expense_id})
        if not existing:
            raise NotFoundError("expense", expense_id)
        self._db["expenses"].delete_one({"id": expense_id})
        self.log_activity(
            actor,
            "DELETE_EXPENSE",
            existing.get("description", expense_id),
            {"amount": existing.get("amount")},
        )
        return {"deleted": True, "id": expense_id}

    # -------------------------------------------------------------------------
    # Online Admission Form Submission & Super Admin Verification
    # -------------------------------------------------------------------------
    def submit_admission(self, payload: dict[str, Any]) -> dict[str, Any]:
        settings = self.get_system_settings()
        if not settings.get("online_admissions_enabled", True):
            raise ValidationError(
                "Online Admission Form is currently turned OFF by the Super Admin."
            )

        student_name = str(
            payload.get("student_name") or payload.get("name") or ""
        ).strip()
        parent_name = str(
            payload.get("parent_name") or payload.get("father_name") or ""
        ).strip()
        dob = str(payload.get("dob") or payload.get("date_of_birth") or "").strip()
        contact_number = str(
            payload.get("contact_number") or payload.get("phone") or ""
        ).strip()
        address = str(payload.get("address") or "").strip()
        course = (
            str(payload.get("course") or payload.get("batch") or "ADOAP")
            .strip()
            .upper()
        )
        admission_date = str(
            payload.get("admission_date")
            or datetime.now(tz=UTC).strftime("%Y-%m-%d")
        ).strip()[:10]
        photo_data_url = payload.get("photo_data_url") or payload.get("photo_url")

        if not student_name:
            raise ValidationError("Student Name is required.")
        if not contact_number or len(re.sub(r"[^0-9]", "", contact_number)) < 10:
            raise ValidationError("Valid 10-digit Contact Number is required.")

        doc = {
            "id": str(uuid4()),
            "application_number": f"BW-ADM-{datetime.now(tz=UTC).strftime('%Y%m%d')}-{uuid4().hex[:4].upper()}",
            "student_name": student_name,
            "parent_name": parent_name,
            "dob": dob,
            "contact_number": re.sub(r"[^0-9]", "", contact_number)[-10:],
            "address": address,
            "course": course,
            "admission_date": admission_date,
            "photo_url": photo_data_url,
            "status": "PENDING",
            "assigned_student_id": None,
            "created_at": datetime.now(tz=UTC).isoformat(),
        }
        self._db["admissions"].insert_one(doc)
        doc.pop("_id", None)
        self.log_activity(None, "SUBMIT_ONLINE_ADMISSION", student_name, {"course": course})
        return doc

    def list_admissions(
        self, actor: CurrentUser, status_filter: str | None = None
    ) -> list[dict[str, Any]]:
        assert_super_admin(actor)
        filt: dict[str, Any] = {}
        if status_filter and status_filter.strip().upper() != "ALL":
            filt["status"] = status_filter.strip().upper()
        rows = list(
            self._db["admissions"]
            .find(filt, {"_id": 0})
            .sort([("created_at", -1)])
        )
        return rows

    def approve_admission(
        self,
        actor: CurrentUser,
        admission_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        adm = self._db["admissions"].find_one({"id": admission_id})
        if not adm:
            raise NotFoundError("admission", admission_id)

        student_id = (
            str(payload.get("student_id") or "").strip().upper()
        )
        if not student_id:
            seq = self._db["students"].count_documents({}) + 1
            student_id = f"RG27{seq:04d}"

        dup = self._db["students"].find_one({"student_id": student_id})
        if dup:
            raise ConflictError(
                f"Student ID '{student_id}' is already assigned to {dup['name']}."
            )

        monthly_fee = float(
            Decimal(str(payload.get("monthly_fee") or 600)).quantize(Decimal("0.01"))
        )
        name = adm["student_name"]
        contact = adm["contact_number"]
        password = str(
            payload.get("password")
            or generate_student_passcode(name, student_id, contact)
        ).strip()
        active_month = get_active_month()

        new_student_uuid = str(uuid4())
        student_doc = {
            "id": new_student_uuid,
            "name": name,
            "student_id": student_id,
            "password": password,
            "parent_name": adm.get("parent_name") or "",
            "dob": adm.get("dob") or "",
            "contact_number": contact,
            "address": adm.get("address") or "",
            "course": adm.get("course") or "ADOAP",
            "batch": adm.get("course") or "ADOAP",
            "admission_date": adm.get("admission_date")
            or datetime.now(tz=UTC).strftime("%Y-%m-%d"),
            "monthly_fee": monthly_fee,
            "fee_status": "UNPAID",
            "month": active_month,
            "photo_url": adm.get("photo_url"),
            "active": True,
            "status": "ACTIVE",
            "created_at": datetime.now(tz=UTC),
        }
        self._db["students"].insert_one(student_doc)

        updated_adm = self._db["admissions"].find_one_and_update(
            {"id": admission_id},
            {
                "$set": {
                    "status": "APPROVED",
                    "assigned_student_id": student_id,
                    "approved_student_uuid": new_student_uuid,
                    "approved_by": actor.identifier or "BWADMIN",
                    "approved_at": datetime.now(tz=UTC).isoformat(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        updated_adm.pop("_id", None)
        self.log_activity(
            actor,
            "APPROVE_ADMISSION",
            f"{name} -> {student_id}",
            {"course": student_doc["course"], "monthly_fee": monthly_fee},
        )
        return {
            "admission": updated_adm,
            "student_id": student_id,
            "password": password,
        }

    def reject_admission(
        self, actor: CurrentUser, admission_id: str
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        adm = self._db["admissions"].find_one({"id": admission_id})
        if not adm:
            raise NotFoundError("admission", admission_id)
        updated = self._db["admissions"].find_one_and_update(
            {"id": admission_id},
            {
                "$set": {
                    "status": "REJECTED",
                    "rejected_by": actor.identifier or "BWADMIN",
                    "rejected_at": datetime.now(tz=UTC).isoformat(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        updated.pop("_id", None)
        self.log_activity(actor, "REJECT_ADMISSION", adm.get("student_name", admission_id))
        return updated

    # -------------------------------------------------------------------------
    # Year-Wise Student Photo Album Management
    # -------------------------------------------------------------------------
    def _ensure_default_albums(self) -> None:
        if self._db["photo_albums"].count_documents({}) == 0:
            defaults = [
                {
                    "id": str(uuid4()),
                    "title": "RGYCSM Annual Certificate Convocation",
                    "year": 2027,
                    "description": "Official diploma and certificate distribution ceremony at Brightway Computer Education.",
                    "visible_to_students": True,
                    "photos": [],
                    "created_at": datetime.now(tz=UTC).isoformat(),
                },
                {
                    "id": str(uuid4()),
                    "title": "Practical Computer Laboratory & Project Exhibition",
                    "year": 2026,
                    "description": "Students working on 1:1 practical computer terminals in ADOAP, DCAE, DDTP, and Python batches.",
                    "visible_to_students": True,
                    "photos": [],
                    "created_at": datetime.now(tz=UTC).isoformat(),
                },
            ]
            for d in defaults:
                self._db["photo_albums"].insert_one(d)

    def list_photo_albums(
        self,
        *,
        year: int | None = None,
        for_student: bool = False,
    ) -> list[dict[str, Any]]:
        self._ensure_default_albums()
        settings = self.get_system_settings()
        if for_student and not settings.get("photo_albums_visible_to_students", True):
            return []

        filt: dict[str, Any] = {}
        if year is not None:
            filt["year"] = int(year)
        if for_student:
            filt["visible_to_students"] = True

        rows = list(
            self._db["photo_albums"]
            .find(filt, {"_id": 0})
            .sort([("year", -1), ("created_at", -1)])
        )
        return rows

    def create_photo_album(
        self, actor: CurrentUser, payload: dict[str, Any]
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        title = str(payload.get("title") or "").strip()
        if not title:
            raise ValidationError("Album title is required.")
        year = int(payload.get("year") or 2027)
        description = str(payload.get("description") or "").strip()
        visible = bool(payload.get("visible_to_students", True))

        doc = {
            "id": str(uuid4()),
            "title": title,
            "year": year,
            "description": description,
            "visible_to_students": visible,
            "photos": [],
            "created_at": datetime.now(tz=UTC).isoformat(),
        }
        self._db["photo_albums"].insert_one(doc)
        doc.pop("_id", None)
        self.log_activity(actor, "CREATE_PHOTO_ALBUM", f"{title} ({year})")
        return doc

    def add_photos_to_album(
        self, actor: CurrentUser, album_id: str, photos: list[dict[str, Any]]
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        album = self._db["photo_albums"].find_one({"id": album_id})
        if not album:
            raise NotFoundError("photo_album", album_id)

        existing_photos: list[dict[str, Any]] = list(album.get("photos") or [])
        now_iso = datetime.now(tz=UTC).isoformat()
        for p in photos:
            img_url = str(p.get("image_url") or p.get("data_url") or "").strip()
            if not img_url:
                continue
            existing_photos.append(
                {
                    "id": str(uuid4()),
                    "caption": str(p.get("caption") or album["title"]).strip(),
                    "image_url": img_url,
                    "year": album.get("year", 2027),
                    "uploaded_at": now_iso,
                }
            )

        updated = self._db["photo_albums"].find_one_and_update(
            {"id": album_id},
            {"$set": {"photos": existing_photos}},
            return_document=ReturnDocument.AFTER,
        )
        updated.pop("_id", None)
        self.log_activity(
            actor,
            "UPLOAD_ALBUM_PHOTOS",
            album["title"],
            {"added_count": len(photos)},
        )
        return updated

    def delete_photo_from_album(
        self, actor: CurrentUser, album_id: str, photo_id: str
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        album = self._db["photo_albums"].find_one({"id": album_id})
        if not album:
            raise NotFoundError("photo_album", album_id)
        remaining = [
            p for p in (album.get("photos") or []) if p.get("id") != photo_id
        ]
        updated = self._db["photo_albums"].find_one_and_update(
            {"id": album_id},
            {"$set": {"photos": remaining}},
            return_document=ReturnDocument.AFTER,
        )
        updated.pop("_id", None)
        return updated

    def delete_photo_album(
        self, actor: CurrentUser, album_id: str
    ) -> dict[str, Any]:
        assert_super_admin(actor)
        album = self._db["photo_albums"].find_one({"id": album_id})
        if not album:
            raise NotFoundError("photo_album", album_id)
        self._db["photo_albums"].delete_one({"id": album_id})
        self.log_activity(actor, "DELETE_PHOTO_ALBUM", album.get("title", album_id))
        return {"deleted": True, "id": album_id}

    # -------------------------------------------------------------------------
    # Database Backup (Super Admin Only)
    # -------------------------------------------------------------------------
    def export_full_backup(self, actor: CurrentUser) -> dict[str, Any]:
        assert_super_admin(actor)
        collections = [
            "students",
            "admins",
            "fee_payments",
            "expenses",
            "admissions",
            "photo_albums",
            "payment_corrections",
            "activity_logs",
            "system_settings",
        ]
        snapshot: dict[str, Any] = {
            "institute": "BRIGHTWAY COMPUTER EDUCATION",
            "exported_at": datetime.now(tz=UTC).isoformat(),
            "exported_by": actor.identifier or "BWADMIN",
            "collections": {},
        }
        for col in collections:
            rows = list(self._db[col].find({}, {"_id": 0}))
            snapshot["collections"][col] = rows
        self.log_activity(actor, "EXPORT_DATABASE_BACKUP", "all_collections")
        return snapshot
