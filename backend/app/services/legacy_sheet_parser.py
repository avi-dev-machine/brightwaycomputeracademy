"""Streaming line-by-line CSV parser for Brightway Computer Academy.

Extracts strictly the core student schema:
  NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES (amount & paid/unpaid), MONTH
Ignores all legacy historical month columns (JAN..DEC from past years).
If a row in the CSV has no STUDENT ID, `student_id` is preserved as `""` (unassigned)
so the Administrator can assign or edit it directly from the Admin Portal.
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

_EMPTY_MARKERS = {"", "-", "NIL", "N/A", "NO", "NONE", "NULL"}


@dataclass
class ParsedStudentRecord:
    student_id: str
    name: str
    password: str
    contact_number: str
    course: str
    batch: str
    monthly_fee: Decimal
    fee_status: str = "UNPAID"
    month: str = field(default_factory=get_active_month)
    passcode: str = ""
    monthly_payments: dict[str, Decimal] = field(default_factory=dict)


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
) -> tuple[Decimal, str]:
    cleaned_fee = _clean(raw_fee).upper()
    cleaned_status = _clean(raw_status).upper()

    status = "UNPAID"
    if cleaned_status == "PAID" or cleaned_fee == "PAID":
        status = "PAID"

    num_str = re.sub(r"[^0-9.]", "", cleaned_fee)
    if not num_str:
        return default, status
    try:
        val = Decimal(num_str).quantize(Decimal("0.01"))
        return (val if val > Decimal("0.00") else default), status
    except InvalidOperation:
        return default, status


def _detect_header_mapping(cells: list[str]) -> dict[str, int] | None:
    lowered = [_clean(c).lower() for c in cells]
    col_map: dict[str, int] = {}

    for idx, col in enumerate(lowered):
        if col in _NAME_HEADERS and "name" not in col_map:
            col_map["name"] = idx
        elif col in _ID_HEADERS and "student_id" not in col_map:
            col_map["student_id"] = idx
        elif col in _PASSWORD_HEADERS and "password" not in col_map:
            col_map["password"] = idx
        elif col in _CONTACT_HEADERS and "contact_number" not in col_map:
            col_map["contact_number"] = idx
        elif col in _COURSE_HEADERS and "course" not in col_map:
            col_map["course"] = idx
        elif col in _FEE_HEADERS and "monthly_fee" not in col_map:
            col_map["monthly_fee"] = idx
        elif col in _STATUS_HEADERS and "fee_status" not in col_map:
            col_map["fee_status"] = idx
        elif col in _MONTH_HEADERS and "month" not in col_map:
            col_map["month"] = idx

    if "name" not in col_map or len(col_map) < 2:
        return None
    return col_map


def iter_parse_csv_stream(
    binary_stream: BinaryIO,
    *,
    year: int = 2027,
    default_batch: str = "GENERAL",
) -> Iterator[ParsedStudentRecord]:
    """Stream-parse CSV rows one line at a time without loading the full file into memory.
    Strictly extracts only NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES, and current MONTH.
    """
    text_stream = io.TextIOWrapper(
        binary_stream, encoding="utf-8-sig", errors="replace", newline=""
    )
    reader = csv.reader(text_stream)

    col_map: dict[str, int] | None = None
    seen_id_to_name: dict[str, str] = {}
    active_month = get_active_month()

    for raw_row in reader:
        cells = [_clean(c) for c in raw_row]
        if not any(cells):
            continue

        detected = _detect_header_mapping(cells)
        if detected is not None:
            col_map = detected
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

        raw_course = _clean(_cell("course")).upper()
        course = raw_course if raw_course else default_batch

        monthly_fee, fee_status = _parse_fee_and_status(
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

        yield ParsedStudentRecord(
            student_id=student_id,
            name=name,
            password=password,
            contact_number=contact,
            course=course,
            batch=course,
            monthly_fee=monthly_fee,
            fee_status=fee_status,
            month=active_month,
            passcode=password,
            monthly_payments={},
        )


def parse_legacy_csv_bytes(
    raw_bytes: bytes,
    *,
    year: int = 2027,
    default_batch: str = "GENERAL",
) -> list[ParsedStudentRecord]:
    return list(
        iter_parse_csv_stream(
            io.BytesIO(raw_bytes),
            year=year,
            default_batch=default_batch,
        )
    )
