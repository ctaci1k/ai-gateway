# backend/routes/keys.py
"""BYOK key endpoints.

- ``POST /keys/validate`` (PH17, D-12): transit-only live check of supplied
  ``(base_url + api_key + model_id)`` entries, per-slot ``ok``/``error``.
- ``GET /keys`` / ``PUT /keys`` / ``DELETE /keys/{slot}`` (PH30, D-20):
  server-side, per-account ENCRYPTED storage. ``GET`` returns write-only
  metadata (``last4`` only). ``PUT`` validates each entry with a live call and
  stores only working ones (encrypted). The plaintext key is never logged and
  never returned.
"""

import asyncio

from fastapi import APIRouter, Depends

from core.auth import current_user, require_csrf
from core.logging import get_logger, log_event
from core.model_filter import is_chat_model
from core.secret_box import is_encryption_configured
from db.models import User
from memory.byok_repository import ByokRepository
from schemas.keys import (
    ByokKeyMeta,
    ByokKeysResponse,
    ByokModelInfo,
    ByokModelsRequest,
    ByokModelsResponse,
    ByokSaveEntry,
    ByokSaveRequest,
    ByokSaveResponse,
    ByokSaveResult,
    KeyValidateEntry,
    KeyValidateRequest,
    KeyValidateResponse,
    KeyValidateResult,
)
from services.provider_service import (
    JUDGE_BYOK_SLOT,
    ProviderService,
    classify_discovery_failure,
)

router = APIRouter(prefix="/keys", tags=["keys"])

logger = get_logger("keys")


def _sanitize_error(error: Exception, api_key: str) -> str:
    """Human-readable error with the secret scrubbed (defense-in-depth)."""
    message = str(error)
    if api_key and api_key in message:
        message = message.replace(api_key, "***")
    return message[:200] or type(error).__name__


def _build_provider(*, slot: str, base_url: str | None, api_key: str, model_id: str):
    """Build a transient provider for a slot (judge vs responder endpoint)."""
    entry = {
        "slot": slot,
        "base_url": base_url,
        "api_key": api_key,
        "model_id": model_id,
    }
    if slot == JUDGE_BYOK_SLOT:
        return ProviderService.build_transient_judge(entry)
    return ProviderService.build_transient_responder(entry)


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
    # Validate concurrently so the total wait is the slowest single key (each is
    # already bounded by a short no-retry timeout, PH21), not their sum. Each
    # _validate_entry catches its own errors, so gather never raises.
    results = await asyncio.gather(
        *(_validate_entry(entry) for entry in request.entries)
    )
    return KeyValidateResponse(results=list(results))


@router.get(
    "",
    response_model=ByokKeysResponse,
    dependencies=[Depends(current_user)],
)
async def get_keys(user: User = Depends(current_user)) -> ByokKeysResponse:
    """Write-only metadata for the current user's stored keys (PH30, D-20).

    Never returns the key itself — only slot/base_url/model_id/last4/custom so
    the UI can show "••••last4" and prefill model/base_url."""
    metas = await ByokRepository(user.id).list_metadata()
    return ByokKeysResponse(keys=[ByokKeyMeta(**m) for m in metas])


async def _validate_save_entry(
    repo: ByokRepository, entry: ByokSaveEntry
) -> ByokSaveResult:
    """Live-validate one entry WITHOUT writing. The key is resolved from the
    request (preferred) or the already-stored credential (when the user changed
    only model/base_url). The key is never logged."""
    api_key = (entry.api_key or "").strip()
    if not api_key:
        stored = await repo.resolve_key(entry.slot)
        if stored is None:
            return ByokSaveResult(
                slot=entry.slot, ok=False, error="No API key provided"
            )
        api_key = stored[0]

    try:
        provider = _build_provider(
            slot=entry.slot,
            base_url=entry.base_url,
            api_key=api_key,
            model_id=entry.model_id,
        )
        await provider.validate_credentials()
    except Exception as error:  # noqa: BLE001 — surface any failure to the UI
        log_event(
            logger,
            "byok_save_validate",
            slot=entry.slot,
            ok=False,
            error=type(error).__name__,
        )
        return ByokSaveResult(
            slot=entry.slot, ok=False, error=_sanitize_error(error, api_key)
        )
    return ByokSaveResult(slot=entry.slot, ok=True)


@router.put(
    "",
    response_model=ByokSaveResponse,
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def put_keys(
    request: ByokSaveRequest, user: User = Depends(current_user)
) -> ByokSaveResponse:
    """Validate + store each entry (PH30, D-20). Failing entries are reported
    but not stored; the response includes fresh metadata for the UI."""
    repo = ByokRepository(user.id)
    if not is_encryption_configured():
        # No KEK → we can't encrypt. Fail every entry cleanly (no 500, no store).
        results = [
            ByokSaveResult(slot=e.slot, ok=False, error="Key storage is not configured")
            for e in request.entries
        ]
        metas = await repo.list_metadata()
        return ByokSaveResponse(results=results, keys=[ByokKeyMeta(**m) for m in metas])

    # Validate concurrently (each bounded by a short no-retry timeout, PH21) so
    # the wait is the slowest single key, not the sum. Then persist the working
    # ones sequentially (one DB write at a time — robust on SQLite + Postgres).
    results = list(
        await asyncio.gather(*(_validate_save_entry(repo, e) for e in request.entries))
    )
    for entry, result in zip(request.entries, results, strict=True):
        if result.ok:
            # Pass the original api_key (possibly None) so the repository reuses
            # the stored ciphertext when only metadata changed.
            await repo.upsert(
                slot=entry.slot,
                model_id=entry.model_id,
                api_key=entry.api_key,
                base_url=entry.base_url,
                custom=entry.custom,
            )
            log_event(logger, "byok_save", slot=entry.slot, ok=True)

    metas = await repo.list_metadata()
    return ByokSaveResponse(results=results, keys=[ByokKeyMeta(**m) for m in metas])


@router.post(
    "/models",
    response_model=ByokModelsResponse,
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def list_models(
    request: ByokModelsRequest, user: User = Depends(current_user)
) -> ByokModelsResponse:
    """List the models an endpoint exposes (BYOK discovery, PH30/D).

    Resolves the key from the request or — when omitted — the stored credential
    for ``slot`` (decrypted server-side). On any failure (no /models, bad key,
    timeout) returns ``{models: [], error_reason}`` so the FE falls back to manual
    entry. The key is transit/in-memory only and never logged."""
    repo = ByokRepository(user.id)
    slot = request.slot or "groq"
    api_key = (request.api_key or "").strip()
    base_url = request.base_url
    if not api_key and request.slot:
        stored = await repo.resolve_key(request.slot)
        if stored is not None:
            api_key, stored_base, _ = stored
            base_url = base_url or stored_base
    if not api_key:
        return ByokModelsResponse(models=[], error_reason="unavailable")

    try:
        provider = _build_provider(
            slot=slot,
            base_url=base_url,
            api_key=api_key,
            model_id="_discovery_",
        )
        ids = await provider.list_models()
    except Exception as error:  # noqa: BLE001 — fall back to manual entry
        # Precise reason (PH30.2): 404 → no_models (manual OK), 401/403 → bad_key
        # (fix the key, don't unlock manual), etc.
        reason = classify_discovery_failure(error)
        log_event(
            logger,
            "byok_models",
            slot=slot,
            ok=False,
            error=type(error).__name__,
            reason=reason,
        )
        return ByokModelsResponse(models=[], error_reason=reason)

    log_event(logger, "byok_models", slot=slot, ok=True, count=len(ids))
    return ByokModelsResponse(
        models=[ByokModelInfo(id=i, is_chat=is_chat_model(i)) for i in ids]
    )


@router.delete(
    "/{slot}",
    response_model=ByokKeysResponse,
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def delete_key(slot: str, user: User = Depends(current_user)) -> ByokKeysResponse:
    """Delete one stored slot and return the remaining metadata (PH30, D-20)."""
    repo = ByokRepository(user.id)
    await repo.delete(slot)
    metas = await repo.list_metadata()
    return ByokKeysResponse(keys=[ByokKeyMeta(**m) for m in metas])
