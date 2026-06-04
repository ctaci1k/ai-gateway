# backend/routes/admin.py
"""Admin API (PH15, D-10): manage accounts + quotas, view usage audit.

The whole router is admin-gated (``require_admin`` → 401 unauth / 403 non-admin);
mutating endpoints additionally require the CSRF token.
"""

from fastapi import APIRouter, Depends

from core.auth import current_user, require_admin, require_csrf
from db.models import User
from schemas.admin import (
    AdminUserList,
    AdminUserSummary,
    AdminUserUsage,
    CreateUserRequest,
    UpdateUserRequest,
)
from services.admin_service import AdminService

router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)]
)


@router.get("/users", response_model=AdminUserList)
async def list_users():
    return AdminUserList(users=await AdminService.list_users())


@router.get("/users/{user_id}/usage", response_model=AdminUserUsage)
async def user_usage(user_id: int):
    return AdminUserUsage(**await AdminService.user_usage(user_id))


@router.post(
    "/users",
    response_model=AdminUserSummary,
    dependencies=[Depends(require_csrf)],
)
async def create_user(payload: CreateUserRequest):
    return AdminUserSummary(
        **await AdminService.create_user(
            payload.username,
            payload.password,
            is_admin=payload.is_admin,
            max_requests_per_minute=payload.max_requests_per_minute,
            max_requests_per_day=payload.max_requests_per_day,
        )
    )


@router.patch(
    "/users/{user_id}",
    response_model=AdminUserSummary,
    dependencies=[Depends(require_csrf)],
)
async def update_user(user_id: int, payload: UpdateUserRequest):
    return AdminUserSummary(
        **await AdminService.update_user(
            user_id, payload.model_dump(exclude_unset=True)
        )
    )


@router.delete("/users/{user_id}", dependencies=[Depends(require_csrf)])
async def delete_user(user_id: int, admin: User = Depends(current_user)):
    """Delete an account and all its data (PH34). Guards in the service forbid
    deleting your own account or the primary admin (403); unknown id → 404."""
    await AdminService.delete_user(admin.id, user_id)
    return {"deleted": True, "id": user_id}
