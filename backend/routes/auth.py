# backend/routes/auth.py

import secrets

from fastapi import APIRouter, Depends, Request, Response

from core.auth import (
    SESSION_COOKIE,
    clear_auth_cookies,
    current_user,
    require_csrf,
    set_auth_cookies,
)
from core.config import get_settings
from core.errors import ForbiddenError, UnauthorizedError
from core.logging import get_logger, log_event
from db.models import User
from schemas.auth import (
    AuthResponse,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    UserResponse,
)
from schemas.common import MessageResponse
from services.auth_service import AuthService
from services.quota_service import QuotaService

router = APIRouter(prefix="/auth", tags=["auth"])

logger = get_logger("auth")


def _verify_registration_code(provided: str) -> None:
    """Refuse self-registration without the configured code (D-10). An empty
    configured code disables open registration entirely."""
    required = get_settings().registration_code
    if not required or not secrets.compare_digest(provided or "", required):
        raise ForbiddenError(
            "Invalid registration code", code="invalid_registration_code"
        )


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, response: Response):
    _verify_registration_code(payload.registration_code)
    user = await AuthService.register(payload.username, payload.password)
    token = await AuthService.create_session(user.id)
    csrf_token = set_auth_cookies(response, token)
    log_event(logger, "user_registered", user_id=user.id)
    return AuthResponse(
        user=UserResponse(id=user.id, username=user.username),
        csrf_token=csrf_token,
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, response: Response):
    user = await AuthService.authenticate(payload.username, payload.password)
    if user is None:
        raise UnauthorizedError("Invalid username or password")
    token = await AuthService.create_session(user.id)
    csrf_token = set_auth_cookies(response, token)
    log_event(logger, "user_login", user_id=user.id)
    return AuthResponse(
        user=UserResponse(id=user.id, username=user.username),
        csrf_token=csrf_token,
    )


@router.post(
    "/logout", response_model=MessageResponse, dependencies=[Depends(require_csrf)]
)
async def logout(
    request: Request, response: Response, user: User = Depends(current_user)
):
    await AuthService.delete_session(request.cookies.get(SESSION_COOKIE))
    clear_auth_cookies(response)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(current_user)):
    snapshot = await QuotaService.usage_snapshot(user)
    return MeResponse(
        id=user.id,
        username=user.username,
        is_admin=user.is_admin,
        max_requests_per_minute=user.max_requests_per_minute,
        max_requests_per_day=user.max_requests_per_day,
        **snapshot,
    )
