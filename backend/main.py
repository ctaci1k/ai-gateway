# backend/main.py
"""FastAPI application factory: config, logging, CORS, rate limiting,
unified error handling and routers."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.db import dispose_engine, init_models
from core.errors import register_error_handlers
from core.logging import configure_logging, get_logger
from core.middleware import (
    NoStoreMiddleware,
    RateLimitMiddleware,
    RequestLoggingMiddleware,
)
from memory.chats_repository import purge_orphan_chat_messages
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.chat import router as chat_router
from routes.chats import router as chats_router
from routes.documents import router as documents_router
from routes.keys import router as keys_router
from routes.memory import router as memory_router
from routes.preferences import router as preferences_router
from routes.providers import router as providers_router
from routes.reports import router as reports_router


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    logger = get_logger("main")

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # Ensure schema exists (dev/runtime). Prod schema is owned by Alembic;
        # both derive from the same Base.metadata.
        await init_models()
        # One-time/defensive cleanup of chat_messages orphaned by the previous
        # non-cascading delete (PH17/A). Idempotent.
        removed = await purge_orphan_chat_messages()
        logger.info(
            "startup",
            extra={
                "extra_fields": {
                    "event": "db_ready",
                    "orphan_messages_removed": removed,
                }
            },
        )
        yield
        await dispose_engine()

    app = FastAPI(title="AI Gateway", version="1.0.0", lifespan=lifespan)

    # Rate limit is innermost of our custom middlewares; CORS is outermost so
    # even throttled/error responses carry CORS headers.
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    app.add_middleware(RequestLoggingMiddleware)
    # Dynamic, per-user API → never cacheable. Prevents a fronting proxy from
    # serving stale GETs (e.g. a stale admin user list after create/delete).
    app.add_middleware(NoStoreMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(chat_router)
    app.include_router(chats_router)
    app.include_router(documents_router)
    app.include_router(keys_router)
    app.include_router(preferences_router)
    app.include_router(providers_router)
    app.include_router(reports_router)
    app.include_router(memory_router)

    @app.get("/")
    def root():
        return {"message": "AI Gateway Backend Running"}

    logger.info(
        "startup",
        extra={
            "extra_fields": {
                "event": "startup",
                "cors_origins": settings.cors_origins_list,
                "rate_limit": f"{settings.rate_limit_requests}/{settings.rate_limit_window_seconds}s",
            }
        },
    )
    return app


app = create_app()
