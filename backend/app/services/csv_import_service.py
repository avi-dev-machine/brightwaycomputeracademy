"""Streaming CSV Data Ingestion Engine for Brightway Computer Academy (MongoDB Atlas).

Strictly imports only the core student fields:
  NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES (amount & paid/unpaid), MONTH
Does NOT import legacy past monthly columns. Preserves unassigned `student_id: ""`
rows so the Admin can add/edit Student IDs directly from the Admin Portal.
"""

import io
from datetime import UTC, datetime
from typing import Any, BinaryIO
from uuid import UUID, uuid4

from pymongo import UpdateOne
from pymongo.database import Database as MongoDatabase

from app.core.constants import get_active_month
from app.core.errors import ValidationError
from app.services.legacy_sheet_parser import iter_parse_csv_stream

BATCH_WRITE_SIZE = 250


class CsvImportService:
    def __init__(self, conn: MongoDatabase[dict[str, Any]]) -> None:
        self._db = conn

    def ingest_stream(
        self,
        binary_stream: BinaryIO,
        *,
        filename: str = "students.csv",
        year: int = 2027,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        total_rows = 0
        inserted_rows = 0
        updated_rows = 0
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
                binary_stream, year=year, default_batch=default_batch
            ),
            start=1,
        ):
            total_rows += 1
            try:
                if not dry_run:
                    # Match by student_id if present, otherwise by (name, course, contact_number)
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
                                    "fee_status": rec.fee_status,
                                    "month": active_month,
                                    "photo_url": None,
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
                "No valid student rows found in CSV. Expected columns: "
                "NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES."
            )

        completed = datetime.now(tz=UTC)
        return {
            "id": str(uuid4()),
            "file_name": filename,
            "status": "DRY_RUN" if dry_run else "COMPLETED",
            "total_rows": total_rows,
            "inserted_rows": inserted_rows,
            "updated_rows": updated_rows,
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
