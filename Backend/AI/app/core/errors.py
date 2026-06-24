"""Domain exception carrying the Engineering Doc 5.4 error envelope fields.

Routes/services raise ``AppError``; a FastAPI exception handler (main.py) renders it
as ``StandardErrorResponse`` with the right HTTP status.
"""

from __future__ import annotations

from app.schemas.common import ErrorCode


class AppError(Exception):
    def __init__(
        self,
        error_code: ErrorCode | str,
        message: str,
        status_code: int,
        retry_after: int | None = None,
    ):
        self.error_code = error_code.value if isinstance(error_code, ErrorCode) else error_code
        self.message = message
        self.status_code = status_code
        self.retry_after = retry_after
        super().__init__(f"{self.error_code}: {message}")


# Convenience constructors for the common cases ---------------------------------
def rate_limit_exceeded(message: str, retry_after: int) -> AppError:
    return AppError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429, retry_after)


def assessment_too_frequent(message: str, retry_after: int) -> AppError:
    return AppError(ErrorCode.ASSESSMENT_TOO_FREQUENT, message, 429, retry_after)


def not_found(error_code: ErrorCode, message: str) -> AppError:
    return AppError(error_code, message, 404)


def unauthorized(message: str = "Missing or invalid credentials") -> AppError:
    return AppError(ErrorCode.UNAUTHORIZED, message, 401)


def forbidden(message: str = "Insufficient permissions") -> AppError:
    return AppError(ErrorCode.FORBIDDEN, message, 403)


def invalid_request(message: str, error_code: ErrorCode = ErrorCode.INVALID_REQUEST) -> AppError:
    return AppError(error_code, message, 400)
