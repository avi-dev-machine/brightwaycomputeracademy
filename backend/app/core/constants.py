"""Constants and dynamic active-month resolution shared across the application."""

from enum import StrEnum

API_V1_PREFIX = "/api/v1"
CURRENCY = "INR"
MIN_ONLINE_PAYMENT_PAISE = 100
MAX_PAGE_SIZE = 500

# Baseline active billing month: June 2026 ("2026-06") matching the populated
# 2026 monthly records from `brightway student record - cert.csv` and
# `brightway student record - non cert.csv`.
BASELINE_ACTIVE_MONTH = "2026-06"
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
    Defaults to '2026-06' so the populated 2026 monthly data from the
    CERT and NON-CERT CSV sheets is immediately visible.
    """
    if override_month and override_month.strip():
        return override_month.strip()
    return BASELINE_ACTIVE_MONTH


def format_month_label(month_year: str) -> str:
    """Format '2026-06' -> 'June 2026'."""
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
