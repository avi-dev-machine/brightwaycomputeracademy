"""Cryptographic password hashing (bcrypt) and student credential verification."""

import base64
import hashlib
import hmac
import re

import bcrypt


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a bcrypt (or legacy PBKDF2) hash."""
    if not plain_password or not password_hash:
        return False
    try:
        if password_hash.startswith(("$2b$", "$2a$", "$2y$")):
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                password_hash.encode("utf-8"),
            )
        if password_hash.startswith("pbkdf2_sha256$"):
            parts = password_hash.split("$")
            if len(parts) != 4:
                return False
            _, iter_str, salt_b64, expected_b64 = parts
            iterations = int(iter_str)
            salt = base64.b64decode(salt_b64.encode("ascii"))
            expected = base64.b64decode(expected_b64.encode("ascii"))
            derived = hashlib.pbkdf2_hmac(
                "sha256", plain_password.encode("utf-8"), salt, iterations
            )
            return hmac.compare_digest(derived, expected)
    except Exception:
        return False
    return False


def generate_student_passcode(name: str, student_id: str, contact_number: str = "") -> str:
    """Derive deterministic student password: first 3 alpha chars of name + last 4 digits of ID (or contact)."""
    clean_name = re.sub(r"[^A-Za-z]", "", name or "").upper()
    prefix = (
        clean_name[:3] if len(clean_name) >= 3 else clean_name.ljust(3, "X")
    ).upper()
    digits = re.sub(r"[^0-9]", "", student_id or "")
    if len(digits) >= 4:
        suffix = digits[-4:]
    else:
        contact_digits = re.sub(r"[^0-9]", "", contact_number or "")
        if len(contact_digits) >= 4 and contact_digits != "0000000000":
            suffix = contact_digits[-4:]
        else:
            suffix = (student_id[-4:] if student_id else "2027").rjust(4, "0").upper()
    return f"{prefix}{suffix}"


def verify_student_credential(
    *,
    name: str,
    student_id: str,
    contact_number: str,
    supplied_secret: str,
    stored_password: str | None = None,
) -> bool:
    """Constant-time verification of stored student password, derived passcode, or contact number."""
    candidate = supplied_secret.strip()
    if not candidate:
        return False

    if stored_password and stored_password.strip():
        clean_stored = stored_password.strip()
        if hmac.compare_digest(
            candidate.encode("utf-8"), clean_stored.encode("utf-8")
        ) or hmac.compare_digest(
            candidate.upper().encode("utf-8"), clean_stored.upper().encode("utf-8")
        ):
            return True

    expected_passcode = generate_student_passcode(name, student_id, contact_number)
    if hmac.compare_digest(
        candidate.upper().encode("utf-8"), expected_passcode.encode("utf-8")
    ):
        return True

    # Also allow login with registered contact number (if valid and non-placeholder)
    clean_contact = re.sub(r"[^0-9]", "", contact_number or "")
    clean_candidate = re.sub(r"[^0-9]", "", candidate)
    if (
        len(clean_contact) >= 10
        and clean_contact != "0000000000"
        and len(clean_candidate) >= 10
        and hmac.compare_digest(
            clean_contact[-10:].encode("utf-8"), clean_candidate[-10:].encode("utf-8")
        )
    ):
        return True

    return False
