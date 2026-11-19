"""Domain and HTTP exceptions with stable machine-readable error codes."""

from typing import Any


class AppError(Exception):
    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: Any = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details
        self.headers = headers


class AuthenticationError(AppError):
    status_code = 401
    code = "UNAUTHENTICATED"


class AuthorizationError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, resource: str, identifier: Any = None) -> None:
        msg = f"{resource} was not found." if identifier is None else f"{resource} '{identifier}' was not found."
        super().__init__(msg, details={"resource": resource})


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class DomainValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


ValidationError = DomainValidationError


class RateLimitError(AppError):
    status_code = 429
    code = "RATE_LIMITED"

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(
            "Too many requests. Please slow down and try again.",
            details={"retry_after_seconds": retry_after_seconds},
            headers={"Retry-After": str(retry_after_seconds)},
        )


class ExternalServiceError(AppError):
    status_code = 502
    code = "UPSTREAM_ERROR"

    def __init__(self, service: str, message: str = "Upstream service call failed.") -> None:
        super().__init__(message, details={"service": service})


class PaymentVerificationError(AppError):
    status_code = 400
    code = "PAYMENT_VERIFICATION_FAILED"
