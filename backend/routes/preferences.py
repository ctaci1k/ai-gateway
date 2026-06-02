# backend/routes/preferences.py

from fastapi import APIRouter, Depends

from core.auth import current_user, require_csrf
from core.errors import ValidationError
from core.prompts import default_judge_prompt
from db.models import User
from memory.repository import get_chat_repository
from schemas.chat_response import ManualSelectionResponse, PreferencesResponse
from schemas.preferences import JudgePromptResponse, JudgePromptUpdate

router = APIRouter(tags=["preferences"])


# Custom judging criteria are bounded so they can't be abused as unbounded
# storage. Only the criteria are user-editable; the mechanical judge scaffold
# (role, rules, JSON/0-100 contract) is fixed server-side, so there are no
# required placeholders for the user to preserve.
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
    """Save (or, when null/blank, reset to default) the user's judging criteria.

    Only the criteria are editable; they are injected into the fixed judge
    scaffold server-side. Free text — the only constraint is a length bound."""
    repository = get_chat_repository(user.id)
    override = (payload.override or "").strip()
    if override:
        if len(override) > _JUDGE_PROMPT_MAX_LEN:
            raise ValidationError("Judging criteria are too long")
        await repository.set_judge_prompt_override(override)
    else:
        await repository.set_judge_prompt_override(None)
    return JudgePromptResponse(
        override=await repository.get_judge_prompt_override(),
        default=default_judge_prompt(),
    )
