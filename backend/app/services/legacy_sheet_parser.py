"""Streaming line-by-line CSV parser for Brightway Computer Education.

Extracts:
  - Core student record: NAME, STUDENT ID, PASSWORD, CONTACT NO., CATEGORY (strictly CERT or NON-CERT), FEES
  - Full monthly fee payment history from all JAN..DEC columns across the sheet
    (`brightway student record - cert.csv` and `brightway student record - non cert.csv`).
"""

import csv
import io
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import BinaryIO

from app.core.constants import get_active_month
from app.core.passwords import generate_student_passcode

_NAME_HEADERS = {"name", "student name", "students name", "full name", "student_name"}
_ID_HEADERS = {
    "student id",
    "student_id",
    "studentid",
    "registration number",
    "registration_number",
    "enrollment number",
    "enrollment_number",
    "id",
    "id no",
    "id_no",
}
_PASSWORD_HEADERS = {"password", "passcode", "pass", "pin", "student password"}
_CONTACT_HEADERS = {
    "contact number",
    "contact_number",
    "contact no.",
    "contact no",
    "contact",
    "phone",
    "phone number",
    "phone_number",
    "mobile",
    "mobile number",
}
_COURSE_HEADERS = {
    "course",
    "course name",
    "batch",
    "batch name",
    "batch_name",
    "batch no",
    "class",
    "program",
    "category",
}
_FEE_HEADERS = {
    "fees",
    "fee",
    "monthly fee",
    "monthly_fee",
    "monthly fees",
    "amount",
    "course fee",
    "fees(paid/unpaid)",
    "fees (paid/unpaid)",
}
_STATUS_HEADERS = {
    "status",
    "fee status",
    "fee_status",
    "fees(paid/unpaid)",
    "fees (paid/unpaid)",
    "paid/unpaid",
}
_MONTH_HEADERS = {"month", "month_year", "active_month", "billing month"}

_EMPTY_MARKERS = {"", "-", "NIL", "N/A", "NO", "NONE", "NULL", "UNPAID", "DUE"}

_MONTH_TOKEN_MAP: dict[str, int] = {
    "jan": 1,
    "january": 1,
    "january 2026": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "jully": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


@dataclass
class ParsedStudentRecord:
    student_id: str
    name: str
    password: str
    contact_number: str
    course: str
    batch: str
    sub_course: str
    monthly_fee: Decimal
    fee_status: str = "UNPAID"
    month: str = field(default_factory=get_active_month)
    passcode: str = ""
    # Maps "YYYY-MM" -> cell note (e.g. "29 May", "10 Apr", "PAID")
    monthly_payments: dict[str, str] = field(default_factory=dict)


def _clean(val: str | None) -> str:
    if not val:
        return ""
    return re.sub(r"\s+", " ", val.strip())


def _clean_name(raw: str) -> str:
    return _clean(raw).strip(";,.- ")


def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"[^0-9]", "", raw or "")
    if len(digits) >= 10:
        return digits[-10:]
    return digits if len(digits) >= 6 else ""


def _parse_fee_and_status(
    raw_fee: str, raw_status: str = "", default: Decimal = Decimal("600.00")
) -> tuple[Decimal, str, bool]:
    cleaned_fee = _clean(raw_fee).upper()
    cleaned_status = _clean(raw_status).upper()

    is_full_paid = "FULL PAID" in cleaned_fee or "FULLPAID" in cleaned_fee
    status = "UNPAID"
    if cleaned_status == "PAID" or cleaned_fee == "PAID" or is_full_paid:
        status = "PAID"

    num_str = re.sub(r"[^0-9.]", "", cleaned_fee)
    if not num_str:
        return default, status, is_full_paid
    try:
        val = Decimal(num_str).quantize(Decimal("0.01"))
        return (val if val > Decimal("0.00") else default), status, is_full_paid
    except InvalidOperation:
        return default, status, is_full_paid


def _detect_month_number(header_cell: str) -> int | None:
    cleaned = _clean(header_cell).lower()
    if cleaned in _MONTH_TOKEN_MAP:
        return _MONTH_TOKEN_MAP[cleaned]
    first_word = cleaned.split(" ")[0] if cleaned else ""
    if first_word in _MONTH_TOKEN_MAP:
        return _MONTH_TOKEN_MAP[first_word]
    return None


def _detect_header_mapping(
    cells: list[str],
) -> tuple[dict[str, int], list[tuple[int, str, int]]] | None:
    """Detect core columns and all repeating JAN..DEC monthly columns."""
    lowered = [_clean(c).lower() for c in cells]
    col_map: dict[str, int] = {}
    month_cols: list[tuple[int, str, int]] = []

    current_year = 2023
    prev_month_num = 0

    for idx, col in enumerate(lowered):
        if col in _NAME_HEADERS and "name" not in col_map:
            col_map["name"] = idx
            continue
        if col in _ID_HEADERS and "student_id" not in col_map:
            col_map["student_id"] = idx
            continue
        if col in _PASSWORD_HEADERS and "password" not in col_map:
            col_map["password"] = idx
            continue
        if col in _CONTACT_HEADERS and "contact_number" not in col_map:
            col_map["contact_number"] = idx
            continue
        if col in _COURSE_HEADERS and "course" not in col_map:
            col_map["course"] = idx
            continue
        if col in _FEE_HEADERS and "monthly_fee" not in col_map:
            col_map["monthly_fee"] = idx
            continue
        if col in _STATUS_HEADERS and "fee_status" not in col_map:
            col_map["fee_status"] = idx
            continue
        if col in _MONTH_HEADERS and "month" not in col_map:
            col_map["month"] = idx
            continue

        m_num = _detect_month_number(col)
        if m_num is not None:
            if "2026" in col:
                current_year = 2026
            elif prev_month_num > 0 and m_num < prev_month_num:
                current_year += 1
            prev_month_num = m_num
            ym = f"{current_year}-{m_num:02d}"
            month_cols.append((idx, ym, m_num))

    if "name" not in col_map or len(col_map) < 2:
        return None
    return col_map, month_cols


def _normalize_category(raw_course: str, default_batch: str) -> str:
    """Normalize category strictly to 'CERT' or 'NON-CERT'."""
    db_up = (default_batch or "").strip().upper()
    if db_up in ("CERT", "NON-CERT"):
        return db_up
    rc_up = (raw_course or "").strip().upper()
    if rc_up in ("NON-CERT", "NON CERT", "NONCERT"):
        return "NON-CERT"
    if rc_up == "CERT":
        return "CERT"
    if any(
        k in rc_up
        for k in ("CLASS", "PYTHON", "EXCEL", "C++", "JAVA", "SCHOOL", "VI", "VII", "VIII", "IX", "XI", "XII")
    ):
        return "NON-CERT"
    return "CERT"


def iter_parse_csv_stream(
    binary_stream: BinaryIO,
    *,
    year: int = 2026,
    default_batch: str = "CERT",
) -> Iterator[ParsedStudentRecord]:
    """Stream-parse CSV rows one line at a time, extracting both student metadata
    and all monthly fee payment columns from the CERT and NON-CERT sheets.
    """
    text_stream = io.TextIOWrapper(
        binary_stream, encoding="utf-8-sig", errors="replace", newline=""
    )
    reader = csv.reader(text_stream)

    col_map: dict[str, int] | None = None
    month_cols: list[tuple[int, str, int]] = []
    seen_id_to_name: dict[str, str] = {}
    active_month = get_active_month()

    for raw_row in reader:
        cells = [_clean(c) for c in raw_row]
        if not any(cells):
            continue

        detected = _detect_header_mapping(cells)
        if detected is not None:
            col_map, month_cols = detected
            continue

        if col_map is None:
            col_map = {
                "name": 0,
                "student_id": 1,
                "contact_number": 2,
                "course": 3,
                "monthly_fee": 4,
            }

        def _cell(key: str) -> str:
            idx = col_map.get(key) if col_map else None
            if idx is None or idx >= len(cells):
                return ""
            return cells[idx]

        name = _clean_name(_cell("name"))
        if not name or name.lower() in _NAME_HEADERS:
            continue

        raw_sub_course = _clean(_cell("course")).upper()
        category = _normalize_category(raw_sub_course, default_batch)

        monthly_fee, fee_status, is_full_paid = _parse_fee_and_status(
            _cell("monthly_fee"), _cell("fee_status"), default=Decimal("600.00")
        )
        contact = _normalize_phone(_cell("contact_number"))

        raw_id = re.sub(r"\s+", "", _cell("student_id")).upper()
        if raw_id in _EMPTY_MARKERS:
            student_id = ""
        else:
            student_id = raw_id
            suffix = 2
            while (
                student_id in seen_id_to_name
                and seen_id_to_name[student_id].upper() != name.upper()
            ):
                student_id = f"{raw_id}-{suffix}"
                suffix += 1
            seen_id_to_name[student_id] = name

        raw_password = _clean(_cell("password"))
        password = (
            raw_password
            if raw_password
            else generate_student_passcode(name, student_id, contact)
        )

        # Extract monthly fee payments from all JAN..DEC columns in this row
        monthly_payments: dict[str, str] = {}
        latest_by_month_num: dict[int, str] = {}

        for col_idx, ym_key, m_num in month_cols:
            if col_idx < len(cells):
                val = _clean(cells[col_idx])
                if val and val.upper() not in _EMPTY_MARKERS:
                    monthly_payments[ym_key] = val
                    latest_by_month_num[m_num] = val

        # Consolidate each student's 12-month payment status into the 2026 & 2027
        # 12-month cycle so every student's paid months (Jan..Dec) from the CSV
        # are immediately populated in the 12-Month Fee Management table.
        for m_num, note_val in latest_by_month_num.items():
            ym_2026 = f"2026-{m_num:02d}"
            ym_2027 = f"2027-{m_num:02d}"
            if ym_2026 not in monthly_payments:
                monthly_payments[ym_2026] = note_val
            if ym_2027 not in monthly_payments:
                monthly_payments[ym_2027] = note_val

        if is_full_paid:
            for m_num in range(1, 13):
                monthly_payments.setdefault(f"2026-{m_num:02d}", "FULL PAID")
                monthly_payments.setdefault(f"2027-{m_num:02d}", "FULL PAID")

        active_m_status = (
            "PAID"
            if (active_month in monthly_payments or fee_status == "PAID")
            else "UNPAID"
        )

        yield ParsedStudentRecord(
            student_id=student_id,
            name=name,
            password=password,
            contact_number=contact,
            course=category,
            batch=category,
            sub_course=raw_sub_course or category,
            monthly_fee=monthly_fee,
            fee_status=active_m_status,
            month=active_month,
            passcode=password,
            monthly_payments=monthly_payments,
        )


def parse_legacy_csv_bytes(
    raw_bytes: bytes,
    *,
    year: int = 2026,
    default_batch: str = "CERT",
) -> list[ParsedStudentRecord]:
    return list(
        iter_parse_csv_stream(
            io.BytesIO(raw_bytes),
            year=year,
            default_batch=default_batch,
        )
    )
