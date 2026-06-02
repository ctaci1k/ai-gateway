# backend/routes/preferences.py

from fastapi import APIRouter, Depends

from core.auth import current_user, require_csrf
from core.errors import ValidationError
from core.prompts import (
    JUDGE_PROMPT_REQUIRED_PLACEHOLDERS,
    default_judge_prompt,
)
from db.models import User
from memory.repository import get_chat_repository
from schemas.chat_response import ManualSelectionResponse, PreferencesResponse
from schemas.preferences import JudgePromptResponse, JudgePromptUpdate

router = APIRouter(tags=["preferences"])


# A custom judge prompt is bounded so it can't be abused as unbounded storage.
_JUDGE_PROMPT_MAX_LEN = 8000


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


@router.get("/preferences/judge-prompt", response_model=JudgePromptResponse)
async def get_judge_prompt(user: User = Depends(current_user)):
    """Return the user's judge-prompt override (or null) + the built-in default
    so the UI can show/restore it (PH24, E2)."""
    repository = get_chat_repository(user.id)
    return JudgePromptResponse(
        override=await repository.get_judge_prompt_override(),
        default=default_judge_prompt(),
    )


@router.put(
    "/preferences/judge-prompt",
    response_model=JudgePromptResponse,
    dependencies=[Depends(require_csrf)],
)
async def set_judge_prompt(
    payload: JudgePromptUpdate, user: User = Depends(current_user)
):
    """Save (or, when null/blank, reset to built-in) the judge-prompt override.

    A non-empty override must keep the required ``$placeholders`` so the judge
    still receives the question, the responses and the allowed labels (E2)."""
    repository = get_chat_repository(user.id)
    override = (payload.override or "").strip()
    if override:
        if len(override) > _JUDGE_PROMPT_MAX_LEN:
            raise ValidationError("Judge prompt is too long")
        missing = [
            ph for ph in JUDGE_PROMPT_REQUIRED_PLACEHOLDERS if ph not in override
        ]
        if missing:
            raise ValidationError(
                "Judge prompt must keep the placeholders: " + ", ".join(missing)
            )
        await repository.set_judge_prompt_override(override)
    else:
        await repository.set_judge_prompt_override(None)
    return JudgePromptResponse(
        override=await repository.get_judge_prompt_override(),
        default=default_judge_prompt(),
    )
