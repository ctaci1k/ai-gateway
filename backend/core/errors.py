# backend/core/errors.py
"""Unified error model and FastAPI exception handlers.

Every error leaves the API with a correct HTTP status code and a body of the
shape ``{"error": {"code": str, "message": str}}`` (decision D-5).
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from core.logging import get_logger

logger = get_logger("errors")


class AppError(Exception):
    """Base class for expected, mapped application errors."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
    ):
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


class ValidationError(AppError):
    status_code = 400
    code = "validation_error"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ProviderError(AppError):
    status_code = 502
    code = "provider_error"


class UpstreamTimeoutError(AppError):
    status_code = 504
    code = "upstream_timeout"


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"


def _error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        logger.warning(
            "app_error",
            extra={
                "extra_fields": {
                    "event": "app_error",
                    "code": exc.code,
                    "status": exc.status_code,
                    "path": request.url.path,
                }
            },
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = exc.errors()
        message = "Request validation failed"
        if details:
            first = details[0]
            loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
            message = f"{loc}: {first.get('msg')}" if loc else first.get("msg", message)
        return JSONResponse(
            status_code=422,
            content=_error_body("validation_error", message),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = "http_error"
        if exc.status_code == 404:
            code = "not_found"
        elif exc.status_code == 405:
            code = "method_not_allowed"
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(code, str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "unhandled_error",
            extra={
                "extra_fields": {
                    "event": "unhandled_error",
                    "error": str(exc),
                    "path": request.url.path,
                }
            },
        )
        return JSONResponse(
            status_code=500,
            content=_error_body("internal_error", "Internal server error"),
        )
