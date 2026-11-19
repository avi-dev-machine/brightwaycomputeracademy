"""Constants and dynamic active-month resolution shared across the application."""

from datetime import UTC, datetime
from enum import StrEnum

API_V1_PREFIX = "/api/v1"
CURRENCY = "INR"
MIN_ONLINE_PAYMENT_PAISE = 100
MAX_PAGE_SIZE = 500

# Baseline active billing month: December 2027 ("2027-12").
# When December 2027 ends and January begins, get_active_month() automatically
# rolls to the new month (e.g., "2028-01") in the frontend while keeping
# December's payment records stored in the backend `fee_payments` collection.
BASELINE_ACTIVE_MONTH = "2027-12"
CURRENT_ACTIVE_MONTH = BASELINE_ACTIVE_MONTH

MONTH_NAMES: dict[str, str] = {
    "01": "January",
    "02": "February",
    "03": "March",
    "04": "April",
    "05": "May",
    "06": "June",
    "07": "July",
    "08": "August",
    "09": "September",
    "10": "October",
    "11": "November",
    "12": "December",
}


def get_active_month(override_month: str | None = None) -> str:
    """Return the active billing month (YYYY-MM).
    Defaults to December 2027 ('2027-12'), and automatically rolls forward
    to January ('2028-01') and subsequent months as the calendar progresses.
    """
    if override_month and override_month.strip():
        return override_month.strip()
    now_ym = datetime.now(tz=UTC).strftime("%Y-%m")
    return max(BASELINE_ACTIVE_MONTH, now_ym)


def format_month_label(month_year: str) -> str:
    """Format '2027-12' -> 'December 2027'."""
    parts = (month_year or BASELINE_ACTIVE_MONTH).split("-")
    if len(parts) == 2 and parts[1] in MONTH_NAMES:
        return f"{MONTH_NAMES[parts[1]]} {parts[0]}"
    return month_year


class Role(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    STUDENT = "STUDENT"


class PaymentStatus(StrEnum):
    PAID = "PAID"
    UNPAID = "UNPAID"
    PENDING = "PENDING"
    FAILED = "FAILED"
