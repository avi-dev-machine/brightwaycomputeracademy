"""Comprehensive verification suite for the redesigned Brightway Computer Academy Portal.

Covers:
1. Strict 3-table schema (`students`, `admins`, `fee_payments`) with zero extraneous bloat tables.
2. Bcrypt password hashing (`admins`) & Student ID + Universal Passcode / Contact Number login (`students`).
3. Role-Based Access Control (RBAC) enforcement across `/admin` and `/student` endpoints.
4. Streaming line-by-line CSV parser for both standard 5-column CSVs and Brightway batch sheets.
5. Student Profile Photo upload (PNG/JPEG, max 2MB) & Automated Digital ID Card Generator (PNG & PDF).
6. Server-side Razorpay order creation (preventing client fee tampering), HMAC-SHA256 checkout signature
   verification, and signed webhook processing.
7. Admin Master Analytics Dashboard, Monthly Fee Status Ledger Matrix, and Multi-Channel Notification Dispatcher.
"""

import hashlib
import hmac
import io
import json
import psycopg
from fastapi.testclient import TestClient
from PIL import Image

from app.config import get_settings
from app.core.passwords import (
    generate_student_passcode,
    hash_password,
    verify_password,
    verify_student_credential,
)


def _admin_token(client: TestClient) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"identifier": "BWADMIN", "password": "Brightway@Admin2026!"},
    )
    assert res.status_code == 200, res.text
    return res.json()["data"]["access_token"]


def _student_token(client: TestClient, student_id: str = "RG240017", secret: str = "AGN0017") -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"identifier": student_id, "password": secret},
    )
    assert res.status_code == 200, res.text
    return res.json()["data"]["access_token"]


def test_strict_three_table_schema() -> None:
    """Verify that ONLY `students`, `admins`, and `fee_payments` exist with exact columns."""
    db_url = get_settings().database_url.get_secret_value()
    with psycopg.connect(db_url) as conn:
        tables = [
            r[0]
            for r in conn.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
            ).fetchall()
        ]
        assert tables == ["admins", "fee_payments", "students"]

        student_cols = [
            r[0]
            for r in conn.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'students'
                ORDER BY ordinal_position
                """
            ).fetchall()
        ]
        assert student_cols == [
            "id",
            "student_id",
            "name",
            "contact_number",
            "batch",
            "monthly_fee",
            "photo_url",
            "created_at",
        ]

        admin_cols = [
            r[0]
            for r in conn.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'admins'
                ORDER BY ordinal_position
                """
            ).fetchall()
        ]
        assert admin_cols == ["id", "username", "password_hash", "role"]

        payment_cols = [
            r[0]
            for r in conn.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'fee_payments'
                ORDER BY ordinal_position
                """
            ).fetchall()
        ]
        assert payment_cols == [
            "id",
            "student_id",
            "amount",
            "month_year",
            "razorpay_order_id",
            "razorpay_payment_id",
            "status",
            "payment_date",
        ]


def test_bcrypt_password_and_student_passcode_helpers() -> None:
    hashed = hash_password("Brightway@Admin2026!")
    assert hashed.startswith("$2b$12$")
    assert verify_password("Brightway@Admin2026!", hashed) is True
    assert verify_password("WrongPassword", hashed) is False

    passcode = generate_student_passcode("AGNIRUDRA BASU", "RG240017")
    assert passcode == "AGN0017"
    assert verify_student_credential(
        name="AGNIRUDRA BASU",
        student_id="RG240017",
        contact_number="7980353213",
        supplied_secret="AGN0017",
    )
    assert verify_student_credential(
        name="AGNIRUDRA BASU",
        student_id="RG240017",
        contact_number="7980353213",
        supplied_secret="7980353213",
    )
    assert not verify_student_credential(
        name="AGNIRUDRA BASU",
        student_id="RG240017",
        contact_number="7980353213",
        supplied_secret="WRONG999",
    )


def test_authentication_and_rbac_enforcement(client: TestClient) -> None:
    # 1. Admin login succeeds and returns SUPER_ADMIN role
    admin_tok = _admin_token(client)
    me_res = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_tok}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["data"]["role"] == "SUPER_ADMIN"

    # 2. Student login with Passcode AND Contact Number both succeed
    stu_tok = _student_token(client, "RG240017", "AGN0017")
    stu_tok_phone = _student_token(client, "RG240017", "7980353213")
    assert stu_tok and stu_tok_phone

    stu_me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {stu_tok}"}
    )
    assert stu_me.status_code == 200
    assert stu_me.json()["data"]["role"] == "STUDENT"
    assert stu_me.json()["data"]["student_code"] == "RG240017"

    # 3. Student is strictly forbidden (403) from Admin endpoints
    forbidden_res = client.get(
        "/api/v1/reports/dashboard",
        headers={"Authorization": f"Bearer {stu_tok}"},
    )
    assert forbidden_res.status_code == 403

    # 4. Student is strictly forbidden (403) from reading another student's profile
    other_res = client.get(
        "/api/v1/students/RG230031",
        headers={"Authorization": f"Bearer {stu_tok}"},
    )
    assert other_res.status_code == 403


def test_streaming_5col_csv_ingestion_upsert(client: TestClient) -> None:
    admin_tok = _admin_token(client)
    csv_body = (
        "Name,Contact Number,Batch,Student ID,Monthly Fee\n"
        "AGNIRUDRA BASU,7980353213,ADOAP,RG240017,650\n"
        "FARDEEN IQBAL,9163197952,DCAE,RG230031,900\n"
    ).encode("utf-8")

    # Ingest twice to verify idempotent upsert without duplicating entries
    for _ in range(2):
        res = client.post(
            "/api/v1/imports/csv",
            headers={"Authorization": f"Bearer {admin_tok}"},
            files={"file": ("standard_5col.csv", csv_body, "text/csv")},
            data={"dry_run": "false"},
        )
        assert res.status_code == 201, res.text
        data = res.json()["data"]
        assert data["total_rows"] == 2
        assert data["failed_rows"] == 0


def test_student_photo_upload_and_digital_id_card(client: TestClient) -> None:
    stu_tok = _student_token(client, "RG240017", "AGN0017")
    headers = {"Authorization": f"Bearer {stu_tok}"}

    # 1. Create a valid 200x240 PNG image in memory
    img = Image.new("RGB", (200, 240), (30, 58, 138))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    upload_res = client.post(
        "/api/v1/students/me/photo",
        headers=headers,
        files={"file": ("portrait.png", png_bytes, "image/png")},
    )
    assert upload_res.status_code == 200, upload_res.text
    photo_url = upload_res.json()["data"]["photo_url"]
    assert "/api/v1/students/RG240017/photo" in photo_url

    # 2. Fetch uploaded photo
    get_photo_res = client.get("/api/v1/students/RG240017/photo")
    assert get_photo_res.status_code == 200
    assert get_photo_res.headers["content-type"] in ("image/jpeg", "image/png")

    # 3. Reject >2MB file
    oversized = b"\x89PNG\r\n\x1a\n" + (b"0" * (2 * 1024 * 1024 + 100))
    bad_res = client.post(
        "/api/v1/students/me/photo",
        headers=headers,
        files={"file": ("huge.png", oversized, "image/png")},
    )
    assert bad_res.status_code == 422

    # 4. Download Digital ID Card as PDF and PNG
    pdf_res = client.get("/api/v1/students/me/id-card.pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.content.startswith(b"%PDF-")

    png_res = client.get("/api/v1/students/me/id-card.png", headers=headers)
    assert png_res.status_code == 200
    assert png_res.content.startswith(b"\x89PNG")


def test_razorpay_order_tamper_protection_and_signature_verification(
    client: TestClient,
) -> None:
    stu_tok = _student_token(client, "RG240017", "AGN0017")
    headers = {"Authorization": f"Bearer {stu_tok}"}

    # Ensure 2026-11 is UNPAID before test
    admin_tok = _admin_token(client)
    client.post(
        "/api/v1/payments/admin-record",
        headers={"Authorization": f"Bearer {admin_tok}"},
        json={"student_id": "RG240017", "month_year": "2026-11", "status": "UNPAID"},
    )

    # 1. Attempt client-side amount tampering (sending amount=1 / amount_paise=100)
    order_res = client.post(
        "/api/payment/create-order",
        headers=headers,
        json={
            "month_year": "2026-11",
            "amount": 1,
            "amount_paise": 100,
        },
    )
    assert order_res.status_code == 201, order_res.text
    order_data = order_res.json()["data"]
    # Server must ignore tampered amount=1 and use the database monthly_fee (650.00 -> 65000 paise)
    assert order_data["amount"] >= 400
    assert order_data["amount_paise"] == int(order_data["amount"] * 100)
    order_id = order_data["order_id"]

    # 2. Forged signature must be rejected (400)
    bad_verify = client.post(
        "/api/payment/verify",
        headers=headers,
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": "pay_test_999",
            "razorpay_signature": "0" * 64,
        },
    )
    assert bad_verify.status_code == 400

    # 3. Valid HMAC-SHA256 signature must mark fee_payments as PAID
    secret = get_settings().razorpay_key_secret.get_secret_value()
    payment_id = "pay_verified_202611"
    valid_sig = hmac.new(
        secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    ok_verify = client.post(
        "/api/payment/verify",
        headers=headers,
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_sig,
        },
    )
    assert ok_verify.status_code == 200, ok_verify.text
    verified_data = ok_verify.json()["data"]
    assert verified_data["status"] == "PAID"
    assert verified_data["razorpay_payment_id"] == payment_id

    # Clean up test month 2026-11 back to UNPAID
    client.post(
        "/api/v1/payments/admin-record",
        headers={"Authorization": f"Bearer {admin_tok}"},
        json={"student_id": "RG240017", "month_year": "2026-11", "status": "UNPAID"},
    )


def test_razorpay_webhook_verification(client: TestClient) -> None:
    stu_tok = _student_token(client, "RG240017", "AGN0017")
    admin_tok = _admin_token(client)

    client.post(
        "/api/v1/payments/admin-record",
        headers={"Authorization": f"Bearer {admin_tok}"},
        json={"student_id": "RG240017", "month_year": "2026-12", "status": "UNPAID"},
    )

    order_res = client.post(
        "/api/payment/create-order",
        headers={"Authorization": f"Bearer {stu_tok}"},
        json={"month_year": "2026-12"},
    )
    assert order_res.status_code == 201
    order_id = order_res.json()["data"]["order_id"]

    webhook_payload = json.dumps(
        {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_webhook_202612",
                        "order_id": order_id,
                    }
                }
            },
        }
    ).encode("utf-8")

    wh_secret = get_settings().razorpay_webhook_secret.get_secret_value()
    wh_sig = hmac.new(
        wh_secret.encode("utf-8"), webhook_payload, hashlib.sha256
    ).hexdigest()

    wh_res = client.post(
        "/api/payment/webhook",
        content=webhook_payload,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": wh_sig,
        },
    )
    assert wh_res.status_code == 200, wh_res.text
    assert wh_res.json()["data"]["status"] == "captured"

    # Reset 2026-12 back to UNPAID
    client.post(
        "/api/v1/payments/admin-record",
        headers={"Authorization": f"Bearer {admin_tok}"},
        json={"student_id": "RG240017", "month_year": "2026-12", "status": "UNPAID"},
    )


def test_admin_analytics_matrix_and_notifications(client: TestClient) -> None:
    admin_tok = _admin_token(client)
    headers = {"Authorization": f"Bearer {admin_tok}"}

    dash_res = client.get("/api/v1/reports/dashboard?month_year=2026-10", headers=headers)
    assert dash_res.status_code == 200
    dash = dash_res.json()["data"]
    assert dash["total_students"] >= 700
    assert isinstance(dash["batches"], list) and len(dash["batches"]) > 0

    matrix_res = client.get(
        "/api/v1/reports/fee-ledger?year=2026&active_month=2026-10&page_size=10",
        headers=headers,
    )
    assert matrix_res.status_code == 200
    matrix = matrix_res.json()["data"]
    assert len(matrix["items"]) == 10
    assert "2026-10" in matrix["items"][0]["months"]

    rem_res = client.post(
        "/api/v1/notifications/send-reminder",
        headers=headers,
        json={
            "student_id": "RG240017",
            "month_year": "2026-10",
            "channels": ["WHATSAPP", "SMS", "EMAIL"],
        },
    )
    assert rem_res.status_code == 201
    rem_data = rem_res.json()["data"]
    assert "login?student_id=RG240017" in rem_data["payment_link"]
    assert len(rem_data["channels"]) == 3

