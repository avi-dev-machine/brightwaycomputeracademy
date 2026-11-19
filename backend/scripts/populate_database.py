"""Clean and seed the Brightway database (`students`, `admins`, `fee_payments`).

Removes all legacy historical fee/month records and re-imports only:
  NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES (amount & paid/unpaid), MONTH ('2027-12' / December 2027)
Rows without a Student ID in the CSV keep `student_id: ""` so the Admin can add/assign
their Student ID directly in the Admin Portal.
"""

import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import get_settings
from app.core.constants import format_month_label, get_active_month
from app.core.passwords import hash_password
from app.db.client import ensure_indexes, get_active_database
from app.services.csv_import_service import CsvImportService

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ALLOWED_COLLECTIONS = {"students", "admins", "fee_payments"}


def seed_database(db: Any) -> None:
    existing_collections = set(db.list_collection_names())
    for col in existing_collections - ALLOWED_COLLECTIONS:
        print(f"Dropping legacy collection: {col}")
        db.drop_collection(col)

    db["fee_payments"].drop()
    db["students"].drop()
    print("Cleared all legacy historical fee/month data from `fee_payments` and `students`.")

    ensure_indexes(db)

    admin_hash = hash_password("Brightway@Admin2026!")
    db["admins"].update_one(
        {"username": "BWADMIN"},
        {
            "$set": {
                "username": "BWADMIN",
                "password_hash": admin_hash,
                "role": "SUPER_ADMIN",
            },
            "$setOnInsert": {
                "id": str(uuid4()),
                "created_at": datetime.now(tz=UTC),
            },
        },
        upsert=True,
    )
    print("Upserted SUPER_ADMIN user 'BWADMIN' into `admins` collection.")

    importer = CsvImportService(db)
    csv_files = [
        REPO_ROOT / "brightway student record - cert.csv",
        REPO_ROOT / "brightway student record - non cert.csv",
    ]
    found_csv = False
    for csv_path in csv_files:
        if csv_path.exists():
            found_csv = True
            with csv_path.open("rb") as f:
                summary = importer.ingest_stream(
                    f, filename=csv_path.name, year=2027, dry_run=False
                )
                print(
                    f"Ingested {csv_path.name}: total={summary['total_rows']}, "
                    f"inserted={summary['inserted_rows']}, updated={summary['updated_rows']}"
                )

    if not found_csv:
        import json
        from pymongo import UpdateOne

        bundled_seed = BACKEND_DIR / "app" / "db" / "seed_data.json"
        if bundled_seed.exists():
            raw = json.loads(bundled_seed.read_text(encoding="utf-8"))
            students_list = raw.get("students", [])
            if students_list:
                ops = [
                    UpdateOne({"id": s["id"]}, {"$set": s}, upsert=True)
                    for s in students_list
                ]
                db["students"].bulk_write(ops, ordered=False)
                print(f"Seeded {len(students_list)} students from bundled seed_data.json.")

    active_month = get_active_month()
    students_count = db["students"].count_documents({})
    with_id_count = db["students"].count_documents({"student_id": {"$gt": ""}})
    missing_id_count = db["students"].count_documents({"student_id": ""})
    payments_count = db["fee_payments"].count_documents({})
    print(
        f"Active Month: {active_month} ({format_month_label(active_month)}) | "
        f"Total Students: {students_count} (Assigned ID: {with_id_count}, Unassigned ID: {missing_id_count}) | "
        f"Fee Payments: {payments_count}"
    )

    print("\nSample Student Credentials (with Student ID):")
    for s in db["students"].find({"student_id": {"$gt": ""}}).limit(5):
        print(
            f"  - NAME: {s['name']} | STUDENT ID: {s['student_id']} | PASSWORD: {s['password']} | "
            f"CONTACT NO.: {s['contact_number']} | COURSE: {s['course']} | "
            f"FEES: INR {s['monthly_fee']} ({s.get('fee_status', 'UNPAID')}) | MONTH: {s.get('month')}"
        )


def main() -> None:
    settings = get_settings()
    db = get_active_database(settings)
    seed_database(db)


if __name__ == "__main__":
    main()
