"""Admin Master Analytics Dashboard & Active-Month Student Fee Ledger Service (MongoDB Atlas).

Implements the dynamic month model:
- Active Month defaults to December 2027 ('2027-12').
- When December ends and January begins ('2028-01'), January replaces December in the frontend
  while December's payment records remain stored in the backend `fee_payments` collection.
"""

import re
from datetime import datetime
from decimal import Decimal
from typing import Any

from pymongo import ASCENDING
from pymongo.database import Database as MongoDatabase

from app.core.constants import format_month_label, get_active_month
from app.core.passwords import generate_student_passcode


class ReportService:
    def __init__(self, conn: MongoDatabase[dict[str, Any]]) -> None:
        self._db = conn

    def dashboard(
        self,
        *,
        month_year: str | None = None,
        batch: str | None = None,
    ) -> dict[str, Any]:
        resolved_month = get_active_month(month_year)
        selected_course = (
            batch.strip()
            if (batch and batch.strip() and batch.strip().upper() != "ALL")
            else None
        )

        all_students = list(
            self._db["students"].find(
                {},
                {
                    "id": 1,
                    "student_id": 1,
                    "course": 1,
                    "batch": 1,
                    "monthly_fee": 1,
                    "_id": 0,
                },
            )
        )

        active_fps_by_key: dict[str, dict[str, Any]] = {}
        active_fps_by_code: dict[str, dict[str, Any]] = {}
        for fp in self._db["fee_payments"].find(
            {"month_year": resolved_month, "status": "PAID"},
            {"student_key": 1, "student_id": 1, "amount": 1, "status": 1, "_id": 0},
        ):
            if fp.get("student_key"):
                active_fps_by_key[fp["student_key"]] = fp
            if fp.get("student_id"):
                active_fps_by_code[fp["student_id"]] = fp

        course_stats: dict[str, dict[str, Any]] = {}
        total_students = 0
        assigned_id_count = 0
        missing_id_count = 0
        paid_students_count = 0
        unpaid_students_count = 0
        monthly_collected = Decimal("0.00")
        monthly_pending = Decimal("0.00")

        for s in all_students:
            s_uuid = str(s["id"])
            code = s.get("student_id") or ""
            c_name = s.get("course") or s.get("batch") or "GENERAL"
            s_fee = Decimal(str(s.get("monthly_fee", 600))).quantize(Decimal("0.01"))
            fp = active_fps_by_key.get(s_uuid) or (
                active_fps_by_code.get(code) if code else None
            )
            is_paid = fp is not None
            paid_amt = (
                Decimal(str(fp.get("amount", s_fee))).quantize(Decimal("0.01"))
                if is_paid
                else Decimal("0.00")
            )

            if c_name not in course_stats:
                course_stats[c_name] = {
                    "batch": c_name,
                    "course": c_name,
                    "student_count": 0,
                    "paid_count": 0,
                    "unpaid_count": 0,
                    "collected_amount": Decimal("0.00"),
                    "pending_amount": Decimal("0.00"),
                }

            c_entry = course_stats[c_name]
            c_entry["student_count"] += 1
            if is_paid:
                c_entry["paid_count"] += 1
                c_entry["collected_amount"] += paid_amt
            else:
                c_entry["unpaid_count"] += 1
                c_entry["pending_amount"] += s_fee

            if selected_course is None or c_name == selected_course:
                total_students += 1
                if code:
                    assigned_id_count += 1
                else:
                    missing_id_count += 1

                if is_paid:
                    paid_students_count += 1
                    monthly_collected += paid_amt
                else:
                    unpaid_students_count += 1
                    monthly_pending += s_fee

        batches = [
            {
                "batch": c_key,
                "course": c_key,
                "student_count": c_val["student_count"],
                "paid_count": c_val["paid_count"],
                "unpaid_count": c_val["unpaid_count"],
                "collected_amount": float(c_val["collected_amount"]),
                "pending_amount": float(c_val["pending_amount"]),
            }
            for c_key, c_val in sorted(course_stats.items(), key=lambda x: x[0])
        ]

        # Backend preserved monthly breakdown (December 2027, January 2028, etc.)
        monthly_pipeline: list[dict[str, Any]] = [
            {"$match": {"status": "PAID"}},
            {
                "$group": {
                    "_id": "$month_year",
                    "paid_count": {"$sum": 1},
                    "collected_amount": {"$sum": "$amount"},
                }
            },
            {"$sort": {"_id": 1}},
        ]
        monthly_agg = list(self._db["fee_payments"].aggregate(monthly_pipeline))

        monthly_map: dict[str, dict[str, Any]] = {}
        all_time_collected = Decimal("0.00")
        for m_row in monthly_agg:
            m_key = str(m_row["_id"])
            amt = Decimal(str(m_row.get("collected_amount", 0))).quantize(
                Decimal("0.01")
            )
            all_time_collected += amt
            monthly_map[m_key] = {
                "month_year": m_key,
                "month_label": format_month_label(m_key),
                "paid_count": int(m_row.get("paid_count", 0)),
                "collected_amount": float(amt),
            }

        available_months = sorted(
            {"2027-12", "2028-01", resolved_month, *monthly_map.keys()}
        )

        return {
            "active_month": resolved_month,
            "active_month_label": format_month_label(resolved_month),
            "available_months": [
                {"month_year": m, "month_label": format_month_label(m)}
                for m in available_months
            ],
            "selected_batch": selected_course or "ALL",
            "selected_course": selected_course or "ALL",
            "total_students": total_students,
            "active_students": total_students,
            "assigned_id_count": assigned_id_count,
            "missing_id_count": missing_id_count,
            "paid_students_count": paid_students_count,
            "unpaid_students_count": unpaid_students_count,
            "overdue_students_count": unpaid_students_count,
            "monthly_revenue_collected": float(monthly_collected),
            "monthly_pending_dues": float(monthly_pending),
            "expected_monthly_revenue": float(monthly_collected + monthly_pending),
            "all_time_revenue_collected": float(all_time_collected),
            "collected_this_month_paise": int(monthly_collected * 100),
            "total_outstanding_paise": int(monthly_pending * 100),
            "total_collected_paise": int(all_time_collected * 100),
            "total_billed_paise": int((all_time_collected + monthly_pending) * 100),
            "active_courses": len(batches),
            "active_batches": len(batches),
            "active_teachers": 1,
            "overdue_fee_count": unpaid_students_count,
            "batches": batches,
            "courses": batches,
            "monthly_breakdown": monthly_map,
        }

    def fee_ledger_matrix(
        self,
        *,
        year: int = 2027,
        active_month: str | None = None,
        batch: str | None = None,
        search: str | None = None,
        status_filter: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> dict[str, Any]:
        resolved_month = get_active_month(active_month)
        mongo_filter: dict[str, Any] = {}

        if batch and batch.strip() and batch.strip().upper() != "ALL":
            b_val = batch.strip()
            mongo_filter["$or"] = [{"course": b_val}, {"batch": b_val}]

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
                    "$and": [{"$or": mongo_filter.pop("$or")}, {"$or": search_or}]
                }
            else:
                mongo_filter["$or"] = search_or

        if status_filter and status_filter.strip().upper() in (
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
            if status_filter.strip().upper() == "PAID":
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
        limit = max(1, min(page_size, 500))
        offset = (max(1, page) - 1) * limit

        student_rows = list(
            self._db["students"]
            .find(mongo_filter)
            .sort([("name", ASCENDING)])
            .skip(offset)
            .limit(limit)
        )

        student_keys = [str(r["id"]) for r in student_rows]
        student_codes = [r["student_id"] for r in student_rows if r.get("student_id")]

        active_fps_by_key: dict[str, dict[str, Any]] = {}
        active_fps_by_code: dict[str, dict[str, Any]] = {}

        if student_keys or student_codes:
            or_q: list[dict[str, Any]] = [{"student_key": {"$in": student_keys}}]
            if student_codes:
                or_q.append({"student_id": {"$in": student_codes}})
            for fp in self._db["fee_payments"].find(
                {"month_year": resolved_month, "$or": or_q}
            ):
                if fp.get("student_key"):
                    active_fps_by_key[fp["student_key"]] = fp
                if fp.get("student_id"):
                    active_fps_by_code[fp["student_id"]] = fp

        matrix_items: list[dict[str, Any]] = []
        for s in student_rows:
            s_uuid = str(s["id"])
            code = s.get("student_id") or ""
            contact = s.get("contact_number") or ""
            course_val = s.get("course") or s.get("batch") or "GENERAL"
            monthly_fee_float = float(Decimal(str(s.get("monthly_fee", 600))))
            pwd = s.get("password") or generate_student_passcode(
                s["name"], code, contact
            )

            fp = active_fps_by_key.get(s_uuid) or (
                active_fps_by_code.get(code) if code else None
            )
            is_paid = bool(fp and fp.get("status") == "PAID")
            status_str = "PAID" if is_paid else "UNPAID"
            p_date = fp.get("payment_date") if fp else None

            cell_data = {
                "id": str(fp["id"]) if fp else None,
                "status": status_str,
                "amount": float(Decimal(str(fp["amount"]))) if fp else monthly_fee_float,
                "razorpay_order_id": fp.get("razorpay_order_id") if fp else None,
                "razorpay_payment_id": fp.get("razorpay_payment_id") if fp else None,
                "payment_date": (
                    p_date.isoformat() if isinstance(p_date, datetime) else p_date
                ),
            }

            matrix_items.append(
                {
                    "id": s_uuid,
                    "name": s["name"],
                    "student_id": code,
                    "has_student_id": bool(code),
                    "password": pwd,
                    "passcode": pwd,
                    "contact_number": contact,
                    "course": course_val,
                    "batch": course_val,
                    "monthly_fee": monthly_fee_float,
                    "fee_status": status_str,
                    "month": resolved_month,
                    "month_label": format_month_label(resolved_month),
                    "photo_url": s.get("photo_url"),
                    "active_month": resolved_month,
                    "active_month_status": status_str,
                    "months": {resolved_month: cell_data},
                    "total_paid": cell_data["amount"] if is_paid else 0.0,
                    "unpaid_months_count": 0 if is_paid else 1,
                }
            )

        return {
            "year": year,
            "active_month": resolved_month,
            "active_month_label": format_month_label(resolved_month),
            "months_header": [resolved_month],
            "items": matrix_items,
            "total": total,
            "page": page,
            "page_size": limit,
        }
