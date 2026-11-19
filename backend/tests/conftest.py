"""Pytest configuration for Brightway Computer Academy strict 3-table test suite."""

from collections.abc import Iterator
from fastapi.testclient import TestClient
import pytest

from app.config import get_settings
from app.db.local_pg import ensure_local_postgres_running
from app.main import create_app


@pytest.fixture(scope="session", autouse=True)
def _ensure_db() -> None:
    settings = get_settings()
    ensure_local_postgres_running(settings.database_url.get_secret_value())


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    settings = get_settings()
    settings.app_env = "test"
    settings.rate_limit_login_per_minute = 1000
    settings.rate_limit_payment_per_minute = 1000
    settings.rate_limit_webhook_per_minute = 1000
    app = create_app(settings)
    with TestClient(app) as c:
        yield c
