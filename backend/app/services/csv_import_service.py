"""Excel (.xlsx) & CSV Data Ingestion and Export Engine for Brightway Computer Education.

Supports:
1. Uploading .xlsx Excel workbooks or .csv files for bulk student import.
2. Duplicate Student ID validation and detailed row-by-row import error reporting.
3. Exporting Student Records, Monthly Fee Ledgers, Payment History, and Cash Flow in .xlsx and .csv formats.
"""

import io
from datetime import UTC, datetime
from typing import Any, BinaryIO
from uuid import UUID, uuid4

from pymongo import ASCENDING, UpdateOne

from app.core.constants import format_month_label, get_active_month
from app.core.errors import ValidationError
from app.core.passwords import generate_student_passcode
from app.services.legacy_sheet_parser import iter_parse_csv_stream
from app.utils.excel_io import (
    build_csv_bytes,
    build_xlsx_bytes,
    xlsx_bytes_to_csv_bytes,
)

BATCH_WRITE_SIZE = 250


class CsvImportService:
    def __init__(self, conn: Any) -> None:
        self._db = conn

    def ingest_stream(
        self,
        binary_stream: BinaryIO,
        *,
        filename: str = "students.xlsx",
        year: int = 2027,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        raw_bytes = binary_stream.read()
        if not raw_bytes:
            raise ValidationError("Uploaded Excel/CSV file is empty.")

        # Automatically convert .xlsx (ZIP magic bytes PK\x03\x04) to CSV stream
        is_xlsx = filename.lower().endswith(".xlsx") or raw_bytes[:4] == b"PK\x03\x04"
        if is_xlsx:
            try:
                csv_bytes = xlsx_bytes_to_csv_bytes(raw_bytes)
            except Exception as exc:
                raise ValidationError(
                    f"Could not read Excel (.xlsx) workbook: {exc}"
                ) from exc
        else:
            csv_bytes = raw_bytes

        stream = io.BytesIO(csv_bytes)
        total_rows = 0
        inserted_rows = 0
        updated_rows = 0
        duplicate_rows = 0
        failed_rows = 0
        errors: list[dict[str, Any]] = []
        sample_students: list[dict[str, Any]] = []

        fname_l = filename.lower()
        default_batch = (
            "NON-CERT"
            if "non" in fname_l
            else ("CERT" if "cert" in fname_l else "GENERAL")
        )

        now = datetime.now(tz=UTC)
        active_month = get_active_month()
        student_ops: list[UpdateOne] = []
        seen_ids_in_file: set[str] = set()

        def _flush_batches() -> None:
            nonlocal inserted_rows, updated_rows
            if student_ops:
                res = self._db["students"].bulk_write(student_ops, ordered=False)
                inserted_rows += res.upserted_count
                updated_rows += res.modified_count + (
                    res.matched_count - res.modified_count
                )
                student_ops.clear()

        for idx, rec in enumerate(
            iter_parse_csv_stream(
                stream, year=year, default_batch=default_batch
            ),
            start=1,
        ):
            total_rows += 1
            try:
                if rec.student_id and rec.student_id in seen_ids_in_file:
                    duplicate_rows += 1
                    errors.append(
                        {
                            "row_number": idx,
                            "student_id": rec.student_id,
                            "error": f"Duplicate Student ID '{rec.student_id}' in uploaded file.",
                        }
                    )

                if rec.student_id:
                    seen_ids_in_file.add(rec.student_id)

                if not dry_run:
                    match_filter: dict[str, Any] = (
                        {"student_id": rec.student_id}
                        if rec.student_id
                        else {
                            "name": rec.name,
                            "course": rec.course,
                            "contact_number": rec.contact_number,
                            "student_id": "",
                        }
                    )
                    student_ops.append(
                        UpdateOne(
                            match_filter,
                            {
                                "$set": {
                                    "name": rec.name,
                                    "student_id": rec.student_id,
                                    "password": rec.password,
                                    "contact_number": rec.contact_number,
                                    "course": rec.course,
                                    "batch": rec.course,
                                    "monthly_fee": float(rec.monthly_fee),
                                },
                                "$setOnInsert": {
                                    "id": str(uuid4()),
                                    "parent_name": "",
                                    "dob": "",
                                    "address": "",
                                    "admission_date": "2027-01-01",
                                    "fee_status": rec.fee_status,
                                    "month": active_month,
                                    "photo_url": None,
                                    "active": True,
                                    "status": "ACTIVE",
                                    "created_at": now,
                                },
                            },
                            upsert=True,
                        )
                    )

                    if len(student_ops) >= BATCH_WRITE_SIZE:
                        _flush_batches()
                else:
                    inserted_rows += 1

                if len(sample_students) < 15:
                    sample_students.append(
                        {
                            "name": rec.name,
                            "student_id": rec.student_id,
                            "password": rec.password,
                            "contact_number": rec.contact_number,
                            "course": rec.course,
                            "batch": rec.course,
                            "monthly_fee": float(rec.monthly_fee),
                            "fee_status": rec.fee_status,
                            "month": active_month,
                            "passcode": rec.password,
                        }
                    )
            except Exception as exc:
                failed_rows += 1
                errors.append(
                    {
                        "row_number": idx,
                        "student_id": rec.student_id,
                        "error": str(exc),
                    }
                )

        if not dry_run:
            _flush_batches()

        if total_rows == 0:
            raise ValidationError(
                "No valid student rows found in Excel/CSV. Expected columns: "
                "NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES."
            )

        completed = datetime.now(tz=UTC)
        return {
            "id": str(uuid4()),
            "file_name": filename,
            "format": "XLSX" if is_xlsx else "CSV",
            "status": "DRY_RUN" if dry_run else "COMPLETED",
            "total_rows": total_rows,
            "inserted_rows": inserted_rows,
            "updated_rows": updated_rows,
            "duplicate_rows": duplicate_rows,
            "skipped_rows": 0,
            "failed_rows": failed_rows,
            "fee_records_upserted": 0,
            "error_summary": {
                "errors": errors[:50],
                "sample_students": sample_students,
            },
            "started_at": now.isoformat(),
            "completed_at": completed.isoformat(),
            "created_at": now.isoformat(),
        }

    def run_import(
        self,
        *,
        filename: str,
        content: bytes | BinaryIO,
        actor_id: UUID | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        stream: BinaryIO = (
            io.BytesIO(content) if isinstance(content, bytes) else content
        )
        return self.ingest_stream(stream, filename=filename, dry_run=dry_run)

    # -------------------------------------------------------------------------
    # Excel (.xlsx) & CSV Export Builders
    # -------------------------------------------------------------------------
    def export_students(
        self,
        *,
        fmt: str = "xlsx",
        active_status: str | None = None,
        course: str | None = None,
    ) -> tuple[bytes, str, str]:
        filt: dict[str, Any] = {}
        if active_status and active_status.upper() == "ACTIVE":
            filt["active"] = {"$ne": False}
        elif active_status and active_status.upper() == "INACTIVE":
            filt["active"] = False
        if course and course.upper() != "ALL":
            filt["$or"] = [{"course": course}, {"batch": course}]

        rows_db = list(
            self._db["students"].find(filt).sort([("name", ASCENDING)])
        )
        headers = [
            "STUDENT ID",
            "STUDENT NAME",
            "PASSWORD",
            "PARENT NAME",
            "CONTACT NO.",
            "ADDRESS",
            "COURSE",
            "ADMISSION DATE",
            "MONTHLY FEE (INR)",
            "STATUS",
        ]
        table_rows: list[list[Any]] = []
        for s in rows_db:
            code = s.get("student_id") or ""
            contact = s.get("contact_number") or ""
            pwd = s.get("password") or generate_student_passcode(
                s["name"], code, contact
            )
            is_act = (
                bool(s["active"])
                if "active" in s and s["active"] is not None
                else (str(s.get("status", "ACTIVE")).upper() != "INACTIVE")
            )
            table_rows.append(
                [
                    code,
                    s.get("name") or "",
                    pwd,
                    s.get("parent_name") or "",
                    contact,
                    s.get("address") or "",
                    s.get("course") or s.get("batch") or "GENERAL",
                    str(s.get("admission_date") or "2027-01-01")[:10],
                    float(s.get("monthly_fee", 600)),
                    "ACTIVE" if is_act else "INACTIVE",
                ]
            )

        if fmt.lower() == "csv":
            return (
                build_csv_bytes(headers, table_rows),
                "text/csv; charset=utf-8",
                "Brightway-Students.csv",
            )
        return (
            build_xlsx_bytes(headers, table_rows, sheet_name="Students"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Brightway-Students.xlsx",
        )

    def export_monthly_fees(
        self,
        *,
        year: int = 2027,
        month_year: str | None = None,
        fmt: str = "xlsx",
    ) -> tuple[bytes, str, str]:
        resolved_month = get_active_month(month_year)
        students = list(
            self._db["students"].find({}).sort([("name", ASCENDING)])
        )
        fps_by_key: dict[str, dict[str, Any]] = {}
        fps_by_code: dict[str, dict[str, Any]] = {}
        for fp in self._db["fee_payments"].find({"month_year": resolved_month}):
            if fp.get("student_key"):
                fps_by_key[fp["student_key"]] = fp
            if fp.get("student_id"):
                fps_by_code[fp["student_id"]] = fp

        headers = [
            "STUDENT NAME",
            "STUDENT ID",
            "COURSE",
            "MONTH",
            "AMOUNT (INR)",
            "PAID / UNPAID STATUS",
            "PAYMENT MODE",
            "RECEIVED BY",
            "PAYMENT DATE",
            "TRANSACTION ID",
        ]
        table_rows: list[list[Any]] = []
        for s in students:
            s_uuid = str(s["id"])
            code = s.get("student_id") or ""
            fp = fps_by_key.get(s_uuid) or (fps_by_code.get(code) if code else None)
            is_paid = bool(fp and fp.get("status") == "PAID")
            p_date = fp.get("payment_date") if fp else None
            p_date_str = (
                p_date.strftime("%Y-%m-%d")
                if isinstance(p_date, datetime)
                else str(p_date or "")[:10]
            )
            table_rows.append(
                [
                    s.get("name") or "",
                    code,
                    s.get("course") or s.get("batch") or "GENERAL",
                    format_month_label(resolved_month),
                    float(fp.get("amount", s.get("monthly_fee", 600)))
                    if fp
                    else float(s.get("monthly_fee", 600)),
                    "PAID" if is_paid else "UNPAID",
                    (fp.get("payment_mode") or "RAZORPAY") if is_paid else "-",
                    (fp.get("received_by") or "Admin") if is_paid else "-",
                    p_date_str if is_paid else "-",
                    (fp.get("razorpay_payment_id") or "-") if is_paid else "-",
                ]
            )

        if fmt.lower() == "csv":
            return (
                build_csv_bytes(headers, table_rows),
                "text/csv; charset=utf-8",
                f"Brightway-Monthly-Fees-{resolved_month}.csv",
            )
        return (
            build_xlsx_bytes(
                headers, table_rows, sheet_name=f"Fees {resolved_month}"
            ),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"Brightway-Monthly-Fees-{resolved_month}.xlsx",
        )

    def export_payment_history(
        self, *, fmt: str = "xlsx"
    ) -> tuple[bytes, str, str]:
        fps = list(
            self._db["fee_payments"]
            .find({"status": "PAID"})
            .sort([("payment_date", -1)])
        )
        headers = [
            "STUDENT NAME",
            "STUDENT ID",
            "COURSE",
            "PAYMENT MONTH",
            "AMOUNT (INR)",
            "PAYMENT MODE",
            "RECEIVED BY",
            "TRANSACTION ID",
            "PAYMENT DATE",
            "STATUS",
        ]
        table_rows: list[list[Any]] = []
        for fp in fps:
            p_date = fp.get("payment_date")
            p_str = (
                p_date.strftime("%Y-%m-%d %H:%M")
                if isinstance(p_date, datetime)
                else str(p_date or "")
            )
            table_rows.append(
                [
                    fp.get("student_name") or "",
                    fp.get("student_id") or "",
                    fp.get("course") or "GENERAL",
                    format_month_label(fp.get("month_year") or ""),
                    float(fp.get("amount", 0)),
                    fp.get("payment_mode") or "CASH",
                    fp.get("received_by") or "Admin",
                    fp.get("razorpay_payment_id") or fp.get("id") or "",
                    p_str,
                    fp.get("status") or "PAID",
                ]
            )

        if fmt.lower() == "csv":
            return (
                build_csv_bytes(headers, table_rows),
                "text/csv; charset=utf-8",
                "Brightway-Payment-History.csv",
            )
        return (
            build_xlsx_bytes(headers, table_rows, sheet_name="Payment History"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Brightway-Payment-History.xlsx",
        )
