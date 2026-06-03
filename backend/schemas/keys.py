# backend/schemas/keys.py
"""BYOK key contracts (PH17 validation; PH30 / D-20 server-side storage).

Validation stays transit-only. Storage (PH30) reverses D-12: keys are persisted
per-account, ENCRYPTED at rest. The plaintext key still NEVER appears in logs or
in any response — ``GET /keys`` returns only write-only metadata (``last4``)."""

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


# --- Server-side storage (PH30, D-20) ---


class ByokKeyMeta(BaseModel):
    """Write-only metadata returned by ``GET /keys`` — never the key itself."""

    slot: str
    base_url: str = ""
    model_id: str
    last4: str = ""
    custom: bool = False


class ByokKeysResponse(BaseModel):
    keys: list[ByokKeyMeta] = Field(default_factory=list)


class ByokSaveEntry(BaseModel):
    """One slot to store. ``api_key`` is optional: when omitted on an existing
    slot, the stored (encrypted) key is reused and only model/base_url change."""

    slot: str = Field(min_length=1, max_length=64)
    base_url: str | None = None
    model_id: str = Field(min_length=1, max_length=256)
    api_key: str | None = None
    custom: bool = False


class ByokSaveRequest(BaseModel):
    entries: list[ByokSaveEntry] = Field(default_factory=list)


class ByokSaveResult(BaseModel):
    slot: str
    ok: bool
    error: str | None = None


class ByokSaveResponse(BaseModel):
    results: list[ByokSaveResult]
    keys: list[ByokKeyMeta] = Field(default_factory=list)


# --- Model discovery (PH30, D) ---------------------------------------------


class ByokModelsRequest(BaseModel):
    """List the models an endpoint exposes. ``api_key`` is optional: when omitted
    the stored key for ``slot`` is reused (decrypted server-side)."""

    slot: str | None = None
    base_url: str | None = None
    api_key: str | None = None


class ByokModelInfo(BaseModel):
    id: str
    # Heuristic flag: looks like a chat model (vs embeddings/tts/image/...).
    is_chat: bool = True


class ByokModelsResponse(BaseModel):
    models: list[ByokModelInfo] = Field(default_factory=list)
    # Set when discovery failed (no /models, bad key, timeout) → FE uses manual
    # entry. Same reason codes as provider failures (classify_provider_failure).
    error_reason: str | None = None
