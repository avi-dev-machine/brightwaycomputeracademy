"""Application configuration loaded from environment variables and backend/.env."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

DEFAULT_MONGODB_URI = ""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "BRIGHTWAY COMPUTER EDUCATION Portal"
    app_env: Literal["development", "test", "staging", "production"] = "development"
    app_base_url: str = "http://localhost:8000"
    public_app_url: str = "http://localhost:3000"
    app_version: str = "2.0.0"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    expose_api_docs: bool | None = None
    timezone: str = "Asia/Kolkata"

    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_jwt_secret: SecretStr = SecretStr("brightway-local-jwt-secret-key-2026")
    jwt_audience: str = "authenticated"

    mongodb_uri: SecretStr = SecretStr(DEFAULT_MONGODB_URI)
    mongodb_db_name: str = "brightway"

    payment_provider: Literal["razorpay", "mock"] | None = None
    razorpay_key_id: str = ""
    razorpay_key_secret: SecretStr = SecretStr("")
    razorpay_webhook_secret: SecretStr = SecretStr("whsec_brightway_test_2026")
    razorpay_api_base: str = "https://api.razorpay.com/v1"

    whatsapp_provider: Literal["meta", "fast2sms"] = "meta"
    whatsapp_access_token: SecretStr = SecretStr("")
    whatsapp_phone_number_id: str = ""
    whatsapp_template_fee_reminder: str = ""
    whatsapp_template_payment_success: str = ""
    whatsapp_business_account_id: str = ""
    whatsapp_webhook_verify_token: SecretStr = SecretStr("")
    whatsapp_app_secret: SecretStr = SecretStr("")
    whatsapp_api_version: str = "v21.0"
    whatsapp_template_language: str = "en"

    sms_provider: Literal["fast2sms"] | None = None
    sms_provider_api_key: SecretStr = SecretStr("")
    sms_sender_id: str = "BRGHTW"
    email_api_key: SecretStr = SecretStr("")

    storage_backend: Literal["supabase", "local"] | None = "local"
    local_storage_dir: str = ".storage"
    student_photo_bucket: str = "student-photos"
    id_card_bucket: str = "id-cards"
    receipt_bucket: str = "receipts"
    academy_assets_bucket: str = "academy-assets"

    max_photo_bytes: int = 2 * 1024 * 1024
    max_csv_bytes: int = 10 * 1024 * 1024
    max_csv_rows: int = 50_000
    pdf_font_path: str = ""
    pdf_font_bold_path: str = ""

    scheduler_interval_seconds: int = 60
    login_rate_limit_per_minute: int = 60
    webhook_rate_limit_per_minute: int = 300
    rate_limit_login_per_minute: int = 60
    rate_limit_webhook_per_minute: int = 300
    rate_limit_payment_per_minute: int = 120

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def allowed_origins(self) -> list[str]:
        origins = [
            origin.strip().rstrip("/")
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]
        return origins or ["http://localhost:3000", "http://127.0.0.1:3000"]

    @property
    def cors_origin_list(self) -> list[str]:
        return self.allowed_origins

    @property
    def supabase_jwks_url(self) -> str:
        if not self.supabase_url:
            return ""
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def resolved_payment_provider(self) -> str:
        if self.payment_provider:
            return self.payment_provider
        if self.razorpay_key_id and self.razorpay_key_secret.get_secret_value():
            return "razorpay"
        return "mock"

    @property
    def resolved_storage_backend(self) -> str:
        if self.storage_backend:
            return self.storage_backend
        return "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()
