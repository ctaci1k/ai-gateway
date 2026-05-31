# backend/routes/keys.py
"""BYOK key validation endpoint (PH17, D-12).

Tests each supplied ``(base_url + api_key + model_id)`` with one lightweight
live call and reports per-slot ``ok``/``error``. Transit-only: keys are never
stored and never logged — only the slot and a sanitized error are recorded.
"""

from fastapi import APIRouter, Depends

from core.auth import current_user, require_csrf
from core.logging import get_logger, log_event
from schemas.keys import (
    KeyValidateEntry,
    KeyValidateRequest,
    KeyValidateResponse,
    KeyValidateResult,
)
from services.provider_service import ProviderService

router = APIRouter(prefix="/keys", tags=["keys"])

logger = get_logger("keys")


def _sanitize_error(error: Exception, api_key: str) -> str:
    """Human-readable error with the secret scrubbed (defense-in-depth)."""
    message = str(error)
    if api_key and api_key in message:
        message = message.replace(api_key, "***")
    return message[:200] or type(error).__name__


async def _validate_entry(entry: KeyValidateEntry) -> KeyValidateResult:
    try:
        provider = (
            ProviderService.build_transient_judge(entry.model_dump())
            if entry.is_judge
            else ProviderService.build_transient_responder(entry.model_dump())
        )
        await provider.validate_credentials()
        log_event(logger, "byok_validate", slot=entry.slot, ok=True)
        return KeyValidateResult(slot=entry.slot, ok=True)
    except Exception as error:  # noqa: BLE001 — surface any failure to the UI
        # Log only the slot + error type — never the key (NQ5).
        log_event(
            logger,
            "byok_validate",
            slot=entry.slot,
            ok=False,
            error=type(error).__name__,
        )
        return KeyValidateResult(
            slot=entry.slot, ok=False, error=_sanitize_error(error, entry.api_key)
        )


@router.post(
    "/validate",
    response_model=KeyValidateResponse,
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def validate_keys(request: KeyValidateRequest) -> KeyValidateResponse:
    results = [await _validate_entry(entry) for entry in request.entries]
    return KeyValidateResponse(results=results)
