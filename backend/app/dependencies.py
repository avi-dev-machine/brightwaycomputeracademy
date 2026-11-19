"""FastAPI dependency wiring for the strict 3-table Brightway architecture."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.core.permissions import AdminUser, StaffUser, StudentUser, SuperAdminUser
from app.core.security import AuthenticatedUser, CurrentUser
from app.db.client import DbConn, DbConnection
from app.integrations.messaging import MessagingGateway, build_messaging_gateway
from app.integrations.razorpay import RazorpayGateway, build_razorpay_gateway
from app.integrations.storage import StorageProvider, build_storage_provider
from app.services.auth_service import AuthService
from app.services.csv_import_service import CsvImportService
from app.services.id_card_service import IdCardService
from app.services.notification_service import NotificationService
from app.services.payment_service import PaymentService
from app.services.report_service import ReportService
from app.services.student_service import StudentService
from app.utils.rate_limit import SlidingWindowLimiter


@dataclass
class ServiceContainer:
    settings: Settings
    conn: DbConnection
    storage: StorageProvider
    razorpay: RazorpayGateway
    messaging: MessagingGateway
    login_limiter: SlidingWindowLimiter
    webhook_limiter: SlidingWindowLimiter
    payment_limiter: SlidingWindowLimiter


def get_container(
    request: Request,
    conn: DbConn,
    settings: Annotated[Settings, Depends(get_settings)],
) -> ServiceContainer:
    state = request.app.state
    if not hasattr(state, "storage"):
        state.storage = build_storage_provider(settings)
    if not hasattr(state, "razorpay"):
        state.razorpay = build_razorpay_gateway(settings)
    if not hasattr(state, "messaging"):
        state.messaging = build_messaging_gateway(settings)
    if not hasattr(state, "login_limiter"):
        state.login_limiter = SlidingWindowLimiter(
            max_requests=settings.rate_limit_login_per_minute, window_seconds=60
        )
    if not hasattr(state, "webhook_limiter"):
        state.webhook_limiter = SlidingWindowLimiter(
            max_requests=settings.rate_limit_webhook_per_minute, window_seconds=60
        )
    if not hasattr(state, "payment_limiter"):
        state.payment_limiter = SlidingWindowLimiter(
            max_requests=settings.rate_limit_payment_per_minute, window_seconds=60
        )
    return ServiceContainer(
        settings=settings,
        conn=conn,
        storage=state.storage,
        razorpay=state.razorpay,
        messaging=state.messaging,
        login_limiter=state.login_limiter,
        webhook_limiter=state.webhook_limiter,
        payment_limiter=state.payment_limiter,
    )


ContainerDep = Annotated[ServiceContainer, Depends(get_container)]


def auth_service(c: ServiceContainer) -> AuthService:
    return AuthService(c.conn, c.settings)


def student_service(c: ServiceContainer) -> StudentService:
    return StudentService(c.conn, c.storage)


def payment_service(c: ServiceContainer) -> PaymentService:
    return PaymentService(c.conn, c.razorpay)


def id_card_service(c: ServiceContainer) -> IdCardService:
    return IdCardService(c.conn, c.storage)


def notification_service(c: ServiceContainer) -> NotificationService:
    return NotificationService(c.conn, c.messaging, c.settings)


def csv_import_service(c: ServiceContainer) -> CsvImportService:
    return CsvImportService(c.conn)


def report_service(c: ServiceContainer) -> ReportService:
    return ReportService(c.conn)


CurrentUserDep = AuthenticatedUser
SuperAdminDep = SuperAdminUser
AdminDep = AdminUser
StaffDep = StaffUser
StudentDep = StudentUser
__all__ = [
    "AdminDep",
    "ContainerDep",
    "CurrentUser",
    "CurrentUserDep",
    "ServiceContainer",
    "StaffDep",
    "StudentDep",
    "SuperAdminDep",
    "auth_service",
    "csv_import_service",
    "get_container",
    "id_card_service",
    "notification_service",
    "payment_service",
    "report_service",
    "student_service",
]
