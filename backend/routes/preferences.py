# backend/routes/preferences.py

from fastapi import APIRouter, Depends

from core.auth import current_user, require_csrf
from core.errors import ValidationError
from db.models import User
from memory.repository import get_chat_repository
from schemas.chat_response import ManualSelectionResponse, PreferencesResponse

router = APIRouter(tags=["preferences"])


@router.post(
    "/preferences/manual-selection",
    response_model=ManualSelectionResponse,
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def manual_selection_feedback(payload: dict, user: User = Depends(current_user)):
    selected_model = payload.get("selected_model")
    selector_model = payload.get("selector_model")

    if not selected_model:
        raise ValidationError("selected_model required")

    repository = get_chat_repository(user.id)
    await repository.track_manual_selection(
        selected_model=selected_model,
        selector_model=selector_model,
    )

    return ManualSelectionResponse(
        success=True,
        personalization_profile=await repository.get_personalization_profile(),
    )


@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(user: User = Depends(current_user)):
    repository = get_chat_repository(user.id)
    return PreferencesResponse(
        preferences=await repository.get_user_preferences(),
        personalization_profile=await repository.get_personalization_profile(),
    )
