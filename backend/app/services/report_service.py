"""Admin Master Analytics Dashboard & 12-Month Fee Status Ledger Matrix Service."""

import re
from datetime import datetime
from decimal import Decimal
from typing import Any

from pymongo import ASCENDING

from app.core.constants import MONTH_NAMES, format_month_label, get_active_month
from app.core.passwords import generate_student_passcode


class ReportService:
    def __init__(self, conn: Any) -> None:
        self._db = conn

    def dashboard(
        self,
        *,
        month_year: str | None = None,
        year: int | None = None,
        batch: str | None = None,
        active_status: str | None = None,
    ) -> dict[str, Any]:
        resolved_month = get_active_month(month_year)
        if year is not None and not month_year:
            m_part = resolved_month.split("-")[1] if "-" in resolved_month else "12"
            resolved_month = f"{year}-{m_part}"

        selected_course = (
            batch.strip()
            if (batch and batch.strip() and batch.strip().upper() != "ALL")
            else None
        )
        status_mode = (active_status or "ALL").strip().upper()

        all_students = list(
            self._db["students"].find(
                {},
                {
                    "id": 1,
                    "student_id": 1,
                    "course": 1,
                    "batch": 1,
                    "monthly_fee": 1,
                    "active": 1,
                    "status": 1,
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

        course_stats: dict[str, dict[str, Any]] = {
            "CERT": {
                "batch": "CERT",
                "course": "CERT",
                "student_count": 0,
                "paid_count": 0,
                "unpaid_count": 0,
                "collected_amount": Decimal("0.00"),
                "pending_amount": Decimal("0.00"),
            },
            "NON-CERT": {
                "batch": "NON-CERT",
                "course": "NON-CERT",
                "student_count": 0,
                "paid_count": 0,
                "unpaid_count": 0,
                "collected_amount": Decimal("0.00"),
                "pending_amount": Decimal("0.00"),
            },
        }
        total_students = 0
        active_students_count = 0
        inactive_students_count = 0
        assigned_id_count = 0
        missing_id_count = 0
        paid_students_count = 0
        unpaid_students_count = 0
        monthly_collected = Decimal("0.00")
        monthly_pending = Decimal("0.00")

        for s in all_students:
            s_uuid = str(s["id"])
            code = s.get("student_id") or ""
            raw_cat = (s.get("batch") or s.get("course") or "CERT").strip().upper()
            c_name = "NON-CERT" if "NON" in raw_cat else "CERT"
            is_active = (
                bool(s["active"])
                if "active" in s and s["active"] is not None
                else (str(s.get("status", "ACTIVE")).upper() != "INACTIVE")
            )
            if status_mode == "ACTIVE" and not is_active:
                continue
            if status_mode == "INACTIVE" and is_active:
                continue

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
                if is_active:
                    active_students_count += 1
                else:
                    inactive_students_count += 1

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

        pending_admissions_count = self._db["admissions"].count_documents(
            {"status": "PENDING"}
        )

        year_str = resolved_month.split("-")[0] if "-" in resolved_month else "2027"
        twelve_months = [f"{year_str}-{m:02d}" for m in range(1, 13)]

        return {
            "active_month": resolved_month,
            "active_month_label": format_month_label(resolved_month),
            "year": int(year_str),
            "available_months": [
                {"month_year": m, "month_label": format_month_label(m)}
                for m in twelve_months
            ],
            "selected_batch": selected_course or "ALL",
            "selected_course": selected_course or "ALL",
            "total_students": total_students,
            "active_students": active_students_count,
            "inactive_students": inactive_students_count,
            "assigned_id_count": assigned_id_count,
            "missing_id_count": missing_id_count,
            "paid_students_count": paid_students_count,
            "unpaid_students_count": unpaid_students_count,
            "overdue_students_count": unpaid_students_count,
            "pending_admissions_count": pending_admissions_count,
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
        year: int = 2026,
        active_month: str | None = None,
        batch: str | None = None,
        search: str | None = None,
        status_filter: str | None = None,
        active_status: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> dict[str, Any]:
        resolved_month = get_active_month(active_month)
        and_conds: list[dict[str, Any]] = []

        if batch and batch.strip() and batch.strip().upper() != "ALL":
            b_val = batch.strip()
            and_conds.append({"$or": [{"course": b_val}, {"batch": b_val}]})

        if active_status and active_status.strip().upper() == "ACTIVE":
            and_conds.append({"active": {"$ne": False}})
        elif active_status and active_status.strip().upper() == "INACTIVE":
            and_conds.append({"active": False})

        if search and search.strip():
            rx = {"$regex": re.escape(search.strip()), "$options": "i"}
            and_conds.append(
                {
                    "$or": [
                        {"name": rx},
                        {"student_id": rx},
                        {"contact_number": rx},
                        {"course": rx},
                        {"batch": rx},
                        {"password": rx},
                    ]
                }
            )

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
                and_conds.append(
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
                and_conds.append(unpaid_cond)

        mongo_filter: dict[str, Any] = (
            {"$and": and_conds}
            if len(and_conds) > 1
            else (and_conds[0] if and_conds else {})
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

        # Fetch all 12 months for the requested `year` (plus `resolved_month`)
        months_header = [f"{year}-{m:02d}" for m in range(1, 13)]
        target_months_set = set(months_header) | {resolved_month}

        fps_by_student_key: dict[str, dict[str, dict[str, Any]]] = {
            k: {} for k in student_keys
        }
        fps_by_student_code: dict[str, dict[str, dict[str, Any]]] = {
            c: {} for c in student_codes
        }

        if student_keys or student_codes:
            or_q: list[dict[str, Any]] = [{"student_key": {"$in": student_keys}}]
            if student_codes:
                or_q.append({"student_id": {"$in": student_codes}})
            for fp in self._db["fee_payments"].find(
                {"month_year": {"$in": list(target_months_set)}, "$or": or_q}
            ):
                m_yr = fp["month_year"]
                if fp.get("student_key") in fps_by_student_key:
                    fps_by_student_key[fp["student_key"]][m_yr] = fp
                if fp.get("student_id") in fps_by_student_code:
                    fps_by_student_code[fp["student_id"]][m_yr] = fp

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
            is_active = (
                bool(s["active"])
                if "active" in s and s["active"] is not None
                else (str(s.get("status", "ACTIVE")).upper() != "INACTIVE")
            )

            months_dict: dict[str, dict[str, Any]] = {}
            total_paid = 0.0
            unpaid_months_count = 0

            for m_key in months_header:
                fp = fps_by_student_key.get(s_uuid, {}).get(m_key) or (
                    fps_by_student_code.get(code, {}).get(m_key) if code else None
                )
                is_paid = bool(fp and fp.get("status") == "PAID")
                status_str = "PAID" if is_paid else "UNPAID"
                p_date = fp.get("payment_date") if fp else None
                amt = (
                    float(Decimal(str(fp.get("amount", monthly_fee_float))))
                    if fp
                    else monthly_fee_float
                )
                p_mode = (
                    fp.get("payment_mode")
                    or (
                        "RAZORPAY"
                        if str(fp.get("razorpay_payment_id") or "").startswith("pay_")
                        else "CASH"
                    )
                    if fp
                    else None
                )
                if is_paid:
                    total_paid += amt
                else:
                    unpaid_months_count += 1

                months_dict[m_key] = {
                    "id": str(fp["id"]) if fp else None,
                    "status": status_str,
                    "amount": amt,
                    "payment_mode": p_mode,
                    "received_by": fp.get("received_by") if fp else None,
                    "razorpay_order_id": fp.get("razorpay_order_id") if fp else None,
                    "razorpay_payment_id": fp.get("razorpay_payment_id")
                    if fp
                    else None,
                    "payment_date": (
                        p_date.isoformat()
                        if isinstance(p_date, datetime)
                        else p_date
                    ),
                }

            active_cell = months_dict.get(resolved_month)
            if active_cell is None:
                fp_act = fps_by_student_key.get(s_uuid, {}).get(resolved_month) or (
                    fps_by_student_code.get(code, {}).get(resolved_month)
                    if code
                    else None
                )
                is_act_paid = bool(fp_act and fp_act.get("status") == "PAID")
                p_act_date = fp_act.get("payment_date") if fp_act else None
                active_cell = {
                    "id": str(fp_act["id"]) if fp_act else None,
                    "status": "PAID" if is_act_paid else "UNPAID",
                    "amount": (
                        float(Decimal(str(fp_act.get("amount", monthly_fee_float))))
                        if fp_act
                        else monthly_fee_float
                    ),
                    "payment_mode": fp_act.get("payment_mode") if fp_act else None,
                    "received_by": fp_act.get("received_by") if fp_act else None,
                    "payment_date": (
                        p_act_date.isoformat()
                        if isinstance(p_act_date, datetime)
                        else p_act_date
                    ),
                }
                months_dict[resolved_month] = active_cell

            matrix_items.append(
                {
                    "id": s_uuid,
                    "name": s["name"],
                    "student_id": code,
                    "has_student_id": bool(code),
                    "password": pwd,
                    "passcode": pwd,
                    "parent_name": s.get("parent_name") or "",
                    "contact_number": contact,
                    "address": s.get("address") or "",
                    "course": course_val,
                    "batch": course_val,
                    "admission_date": str(s.get("admission_date") or "2027-01-01")[:10],
                    "monthly_fee": monthly_fee_float,
                    "fee_status": active_cell["status"],
                    "month": resolved_month,
                    "month_label": format_month_label(resolved_month),
                    "photo_url": s.get("photo_url"),
                    "active": is_active,
                    "status": "ACTIVE" if is_active else "INACTIVE",
                    "active_month": resolved_month,
                    "active_month_status": active_cell["status"],
                    "active_payment_date": active_cell.get("payment_date"),
                    "active_payment_mode": active_cell.get("payment_mode"),
                    "active_received_by": active_cell.get("received_by"),
                    "months": months_dict,
                    "total_paid": round(total_paid, 2),
                    "unpaid_months_count": unpaid_months_count,
                }
            )

        return {
            "year": year,
            "active_month": resolved_month,
            "active_month_label": format_month_label(resolved_month),
            "months_header": months_header,
            "month_labels": {
                f"{year}-{m:02d}": MONTH_NAMES[f"{m:02d}"][:3] for m in range(1, 13)
            },
            "items": matrix_items,
            "total": total,
            "page": page,
            "page_size": limit,
        }
