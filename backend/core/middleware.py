# backend/core/middleware.py
"""HTTP middleware: request logging and a simple in-memory rate limiter."""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.logging import get_logger, log_event

logger = get_logger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request with method, path, status code and duration."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        log_event(
            logger,
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window-ish sliding rate limit per client IP for mutating requests."""

    def __init__(self, app, *, max_requests: int, window_seconds: int):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _client_key(self, request: Request) -> str:
        client = request.client
        return client.host if client else "unknown"

    async def dispatch(self, request: Request, call_next) -> Response:
        # Only throttle state-changing requests; reads are cheap and idempotent.
        if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
            return await call_next(request)

        key = self._client_key(request)
        now = time.monotonic()
        window_start = now - self.window_seconds
        hits = self._hits[key]

        while hits and hits[0] < window_start:
            hits.popleft()

        if len(hits) >= self.max_requests:
            retry_after = max(1, int(hits[0] + self.window_seconds - now))
            log_event(
                logger,
                "rate_limited",
                client=key,
                path=request.url.path,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "rate_limited",
                        "message": "Too many requests. Please slow down.",
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)
        return await call_next(request)
