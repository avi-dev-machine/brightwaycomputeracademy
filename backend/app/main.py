"""FastAPI application entrypoint for BRIGHTWAY COMPUTER EDUCATION Portal (Render & MongoDB Atlas Ready)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import payments
from app.api.v1.router import api_router
from app.config import Settings, get_settings
from app.core.constants import API_V1_PREFIX, get_active_month
from app.core.errors import register_exception_handlers
from app.core.logging import RequestContextMiddleware, configure_logging
from app.db.client import close_pool, init_pool
from app.integrations.messaging import build_messaging_gateway
from app.integrations.razorpay import build_razorpay_gateway
from app.integrations.storage import build_storage_provider
from app.utils.rate_limit import SlidingWindowLimiter


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    configure_logging(settings.log_level)

    init_pool(settings)

    app.state.storage = build_storage_provider(settings)
    app.state.razorpay = build_razorpay_gateway(settings)
    app.state.messaging = build_messaging_gateway(settings)
    app.state.login_limiter = SlidingWindowLimiter(
        max_requests=settings.rate_limit_login_per_minute, window_seconds=60
    )
    app.state.webhook_limiter = SlidingWindowLimiter(
        max_requests=settings.rate_limit_webhook_per_minute, window_seconds=60
    )
    app.state.payment_limiter = SlidingWindowLimiter(
        max_requests=settings.rate_limit_payment_per_minute, window_seconds=60
    )
    try:
        yield
    finally:
        close_pool()


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or get_settings()
    docs_enabled = (
        resolved.expose_api_docs
        if resolved.expose_api_docs is not None
        else not resolved.is_production
    )

    app = FastAPI(
        title=resolved.app_name,
        version="2.0.0",
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
        lifespan=_lifespan,
    )
    app.state.settings = resolved

    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved.allowed_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-ID",
            "X-Razorpay-Signature",
            "Idempotency-Key",
        ],
        expose_headers=["X-Request-ID", "Content-Disposition"],
    )
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)

    @app.api_route("/", methods=["GET", "HEAD"], tags=["health"])
    @app.api_route("/health", methods=["GET", "HEAD"], tags=["health"])
    def root_health() -> dict[str, Any]:
        return {
            "success": True,
            "data": {
                "service": "BRIGHTWAY COMPUTER EDUCATION API",
                "status": "ok",
                "active_month": get_active_month(),
            },
        }

    app.include_router(api_router, prefix=API_V1_PREFIX)
    app.include_router(payments.router, prefix="/api/payment", tags=["payment-direct"])
    return app


app = create_app()
