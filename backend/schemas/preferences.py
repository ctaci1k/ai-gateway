# backend/schemas/preferences.py
"""Request/response models for user preference endpoints (PH24, E2)."""

from pydantic import BaseModel


class JudgePromptResponse(BaseModel):
    # The user's custom judge prompt, or null when using the built-in default.
    override: str | None
    # The built-in judge-prompt template (read-only), shown in the UI and used
    # as the "Reset to default" target.
    default: str


class JudgePromptUpdate(BaseModel):
    # null or blank → reset to the built-in default.
    override: str | None = None
