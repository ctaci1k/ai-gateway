# backend/core/auth.py
"""Auth dependencies: session cookie → current user, and CSRF protection.

Session cookie is httpOnly + SameSite=Lax (+ Secure in prod), which already
blocks cross-site cookie sending. A double-submit CSRF token adds defense in
depth for state-changing requests.
"""

import secrets

from fastapi import Depends, Request, Response

from core.config import get_settings
from core.errors import ForbiddenError, UnauthorizedError
from db.models import User
from services.auth_service import AuthService

SESSION_COOKIE = "session"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "x-csrf-token"


def set_auth_cookies(response: Response, session_token: str) -> str:
    """Set the session + CSRF cookies; return the CSRF token issued."""
    settings = get_settings()
    max_age = settings.session_ttl_hours * 3600
    csrf_token = secrets.token_urlsafe(32)

    response.set_cookie(
        SESSION_COOKIE,
        session_token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf_token,
        max_age=max_age,
        httponly=False,  # readable by the SPA to echo back in a header
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    return csrf_token


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


async def current_user(request: Request) -> User:
    """Return the authenticated user or raise 401."""
    token = request.cookies.get(SESSION_COOKIE)
    user = await AuthService.get_user_for_session(token)
    if user is None:
        raise UnauthorizedError("Authentication required")
    return user


async def require_csrf(request: Request) -> None:
    """Double-submit CSRF check for state-changing requests."""
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header or not secrets.compare_digest(cookie, header):
        raise ForbiddenError("CSRF token missing or invalid")


async def require_admin(user: User = Depends(current_user)) -> User:
    """Gate admin-only endpoints (PH15, D-10): 401 if unauthenticated (via
    current_user), 403 for a non-admin user."""
    if not user.is_admin:
        raise ForbiddenError("Admin access required")
    return user
