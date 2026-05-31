# backend/schemas/keys.py
"""BYOK key-validation contracts (PH17, D-12).

Validation is transit-only: each entry is tested with a live call and the result
returned. Nothing is stored; keys never appear in logs or responses."""

from pydantic import BaseModel, Field


class KeyValidateEntry(BaseModel):
    slot: str = Field(min_length=1, max_length=64)
    base_url: str | None = None
    api_key: str = Field(min_length=1)
    model_id: str = Field(min_length=1, max_length=256)
    # The judge slot defaults to the Groq endpoint when no base_url is given.
    is_judge: bool = False


class KeyValidateRequest(BaseModel):
    entries: list[KeyValidateEntry] = Field(default_factory=list)


class KeyValidateResult(BaseModel):
    slot: str
    ok: bool
    error: str | None = None


class KeyValidateResponse(BaseModel):
    results: list[KeyValidateResult]
