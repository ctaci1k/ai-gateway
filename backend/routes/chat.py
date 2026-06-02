# backend/routes/chat.py

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.auth import current_user, require_csrf
from core.logging import get_logger, log_event
from core.prompts import render_prompt
from core.tokens import estimate_tokens
from db.models import User
from memory import preferences_logic
from memory.chats_repository import SavedChatRepository
from memory.repository import get_chat_repository
from memory.usage_repository import UsageRepository
from schemas.chat_response import ChatResponse, RagSource, StructuredChatResponse
from schemas.chat_schema import ChatRequest
from services.orchestrator_service import OrchestratorService
from services.provider_service import (
    JUDGE_BYOK_SLOT,
    ProviderService,
    TransientProvider,
    classify_provider_failure,
)
from services.quota_service import QuotaService
from services.rag_service import RagService

router = APIRouter(tags=["chat"])

logger = get_logger("chat")


def _build_byok_judge(request: ChatRequest):
    """Build a transient judge provider + its UI label from the request's BYOK
    config, or (None, None) when no judge key was supplied (PH17)."""
    if request.byok and request.byok.judge:
        judge = request.byok.judge
        return (
            ProviderService.build_transient_judge(judge.model_dump()),
            {"provider": "byok", "model": judge.model_id},
        )
    return None, None


@router.post(
    "/chat",
    response_model=ChatResponse,
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def chat(request: ChatRequest, user: User = Depends(current_user)):
    repository = get_chat_repository(user.id)

    provider_names = request.providers or [request.provider]

    # BYOK (PH17): resolve responders + judge on the user's transient keys.
    # Built-in slots without a key fall back to the app's singletons.
    byok_responders = (
        [r.model_dump() for r in request.byok.responders] if request.byok else None
    )
    providers_map = ProviderService.resolve_responders(provider_names, byok_responders)
    judge_provider, judge_label = _build_byok_judge(request)

    # Quota (PH17): a Compare turn is free only when every participant — all
    # responders and the judge — runs on the user's own key. Otherwise it counts
    # as one request and is enforced + recorded against the account quota (D-10).
    all_byok = (
        bool(providers_map)
        and all(isinstance(p, TransientProvider) for p in providers_map.values())
        and judge_provider is not None
    )
    should_charge = not all_byok
    if should_charge:
        await QuotaService.check(user)

    # RAG (PH10): retrieve grounding context from the user's documents.
    rag_sources: list[dict] = []
    rag_context: str | None = None
    if request.rag_enabled:
        rag_sources = await RagService.retrieve(user.id, request.message)
        rag_context = RagService.build_context(rag_sources) if rag_sources else None

    # Per-user judge-prompt override (PH24, E2): when set, it replaces the
    # built-in judge instructions; only relevant when the selector runs.
    judge_prompt_override = (
        await repository.get_judge_prompt_override()
        if request.selector_enabled
        else None
    )

    result = await OrchestratorService.process_chat(
        message=request.message,
        provider_names=provider_names,
        compare_mode=request.compare_mode,
        selector_enabled=request.selector_enabled,
        personalization_profile=await repository.get_personalization_profile(),
        rag_context=rag_context,
        providers_map=providers_map,
        judge_provider=judge_provider,
        judge_label=judge_label,
        judge_prompt_override=judge_prompt_override,
    )

    selector_metadata = result["selector_metadata"]

    if request.selector_enabled:
        log_event(
            logger,
            "judge_decision",
            user_id=user.id,
            selected_model=result["selected_model"],
            selector_provider=selector_metadata.get("selector_provider"),
            selector_model=selector_metadata.get("selector_model"),
            confidence=selector_metadata.get("selector_confidence", 0),
            fallback_used=selector_metadata.get("fallback_used", False),
            scores=result["selector_scores"],
        )

    interaction = dict(
        user_message=request.message,
        best_response=result["best_response"],
        selected_model=result["selected_model"],
        all_responses=result["all_responses"],
        failed_providers=result["failed_providers"],
        selector_used=result["selector_enabled"],
        execution_metadata=result["execution_metadata"],
        execution_summary=result["execution_summary"],
        selector_scores=result["selector_scores"],
        selector_reason=result["selector_reason"],
        selector_metadata=selector_metadata,
        compare_mode=result["compare_mode"],
        selector_provider=selector_metadata.get("selector_provider"),
        selector_model=selector_metadata.get("selector_model"),
        selector_confidence=selector_metadata.get("selector_confidence", 0),
        selector_fallback_used=selector_metadata.get("fallback_used", False),
        manual_override=request.manual_override,
        manually_selected_model=request.manually_selected_model,
    )

    # Rolling personalization history (always).
    await repository.add_message(**interaction)

    # Persist into a saved chat when one is active (PH9). Ownership is verified
    # by the repository (404 for a foreign/unknown chat). Done BEFORE the ledger
    # write so a bad chat_id 404s instead of tripping the usage_events FK (D-18).
    if request.chat_id is not None:
        record = preferences_logic.build_interaction_record(**interaction)
        await SavedChatRepository(user.id).add_message(request.chat_id, record)

    # Append-only per-turn ledger (PH15, D-10; PH27, D-18). A Compare request is
    # a single event; success means at least one provider answered. PH27: ALL
    # turns are recorded, including BYOK — ``billable`` marks whether the turn
    # consumed the account quota (False = own keys). Quota windows count only
    # billable rows (A4), so recording BYOK turns does not change limits. Tokens
    # are real when a responder reported usage, else an estimate (B2).
    real_tokens = result.get("total_tokens")
    if real_tokens is not None:
        total_tokens, token_estimated = real_tokens, False
    else:
        total_tokens = estimate_tokens(
            request.message, result.get("best_response") or ""
        )
        token_estimated = True
    await UsageRepository(user.id).record(
        mode="compare" if result["compare_mode"] else "single",
        message=request.message,
        selected_model=result["selected_model"],
        success=bool(result["all_responses"]),
        total_tokens=total_tokens,
        token_estimated=token_estimated,
        chat_id=request.chat_id,
        billable=should_charge,
    )

    return ChatResponse(
        response=result["best_response"],
        selected_model=result["selected_model"],
        selected_model_data=result["selected_model_data"],
        all_responses=result["all_responses"],
        failed_providers=result["failed_providers"],
        execution_metadata=result["execution_metadata"],
        execution_summary=result["execution_summary"],
        compare_mode=result["compare_mode"],
        selector_enabled=result["selector_enabled"],
        selector_scores=result["selector_scores"],
        selector_metadata=selector_metadata,
        selector_reason=result["selector_reason"],
        compare_summary=result["compare_summary"],
        comparison_count=result.get("comparison_count", 0),
        personalization_profile=await repository.get_personalization_profile(),
        personalization_enabled=selector_metadata.get("personalization_enabled", False),
        manual_override=request.manual_override,
        manually_selected_model=request.manually_selected_model,
        rag_enabled=request.rag_enabled,
        rag_sources=[
            RagSource(
                document_id=s.get("document_id"),
                filename=s.get("filename"),
                chunk_index=s.get("chunk_index"),
                score=s.get("score"),
                snippet=(s.get("text") or "")[:280],
            )
            for s in rag_sources
        ],
    )


def _resolve_single_provider(request: ChatRequest):
    """Resolve the Single-mode provider for the chosen slot (PH17).

    Returns ``(provider_or_None, is_byok)``. The judge's model is selectable in
    Single too (NQ6): a request for the judge slot builds the judge as a
    responder. ``None`` means use the built-in singleton (charged); a transient
    provider means the user's own key (free)."""
    byok = request.byok
    slot = request.provider
    if byok:
        if slot == JUDGE_BYOK_SLOT and byok.judge:
            return ProviderService.build_transient_judge(byok.judge.model_dump()), True
        for responder in byok.responders:
            if responder.slot == slot:
                return (
                    ProviderService.build_transient_responder(responder.model_dump()),
                    True,
                )
    return None, False


@router.post(
    "/chat/stream",
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def chat_stream(request: ChatRequest, user: User = Depends(current_user)):
    repository = get_chat_repository(user.id)

    # BYOK (PH17): resolve the chosen model. Single is free only when it runs on
    # the user's own key; otherwise it counts as one request (enforced now,
    # recorded after the stream).
    byok_provider, is_byok = _resolve_single_provider(request)
    should_charge = not is_byok
    if should_charge:
        await QuotaService.check(user)

    # Single + RAG (PH13/C3): ground the chosen model in the user's documents.
    # The judge isn't involved in Single mode; we inject context straight into
    # the streamed prompt and return the sources as a terminal stream event.
    rag_sources: list[dict] = []
    responder_message = request.message
    if request.rag_enabled:
        rag_sources = await RagService.retrieve(user.id, request.message)
        if rag_sources:
            responder_message = render_prompt(
                "rag_augmented",
                context=RagService.build_context(rag_sources),
                question=request.message,
            )

    async def generate():
        parts: list[str] = []
        model_name: str | None = None
        stream_tokens: int | None = None
        completed = False
        try:
            async for event in ProviderService.generate_stream(
                message=responder_message,
                provider_name=request.provider,
                provider=byok_provider,
            ):
                event_type = event.get("type")
                if event_type == "token":
                    parts.append(event.get("content") or "")
                    model_name = event.get("model") or model_name
                elif event_type == "usage":
                    # Real provider usage (PH27/B1): captured for the ledger,
                    # not forwarded to the client.
                    stream_tokens = event.get("total_tokens")
                    continue
                yield json.dumps(event) + "\n"
            completed = True
        except Exception as error:
            # Classify the failure so the UI can tell a BYOK key's own provider
            # rate-limit (the user must check their provider account) apart from
            # our quota (PH18/8, D-13). Same reason codes as Compare.
            reason = classify_provider_failure(str(error))
            log_event(
                logger,
                "stream_error",
                provider=request.provider,
                error=str(error),
                reason=reason,
            )
            yield (
                json.dumps({"type": "error", "content": str(error), "reason": reason})
                + "\n"
            )

        # Terminal sources event so the UI can show grounding for Single+RAG (C3).
        if request.rag_enabled:
            yield (
                json.dumps(
                    {
                        "type": "sources",
                        "sources": [
                            {
                                "document_id": s.get("document_id"),
                                "filename": s.get("filename"),
                                "chunk_index": s.get("chunk_index"),
                                "score": s.get("score"),
                                "snippet": (s.get("text") or "")[:280],
                            }
                            for s in rag_sources
                        ],
                    }
                )
                + "\n"
            )

        # Persist the completed Single turn. Always recorded in rolling history
        # for personalization (PH13/B3). PH24 (D-17): when a saved Single chat is
        # active (chat_id set), the turn is ALSO appended to that named chat —
        # Single chats are now first-class saved chats, mirroring Compare.
        full_text = "".join(parts).strip()
        # The chat the ledger row links to: stays None unless the turn was
        # actually appended to an owned chat, so a foreign/stale chat_id never
        # trips the usage_events FK (D-18).
        chat_link: int | None = None
        if completed and full_text:
            single_response = {
                "response": full_text,
                "model": model_name or request.provider,
                "provider": request.provider,
                "success": True,
            }
            interaction = dict(
                user_message=request.message,
                best_response=full_text,
                selected_model=request.provider,
                all_responses={request.provider: single_response},
                selector_used=False,
                compare_mode=False,
            )
            await repository.add_message(**interaction)

            # Append to the saved Single chat when one is active. Wrapped so a
            # foreign/stale chat_id can't break the already-delivered stream tail
            # (the FE always creates+owns the chat before streaming).
            if request.chat_id is not None:
                try:
                    record = preferences_logic.build_interaction_record(**interaction)
                    await SavedChatRepository(user.id).add_message(
                        request.chat_id, record
                    )
                    chat_link = request.chat_id
                except Exception as error:  # noqa: BLE001
                    log_event(
                        logger,
                        "single_chat_persist_failed",
                        chat_id=request.chat_id,
                        error=str(error),
                    )

        # Append-only per-turn ledger (PH15, D-10; PH27, D-18). PH27: every
        # Single turn is recorded, including BYOK — ``billable`` marks whether it
        # consumed the account quota (False = own key; quota windows count only
        # billable rows, A4). Tokens are real when the stream reported usage
        # (include_usage, B1), else an estimate over prompt + answer (B2).
        if stream_tokens is not None:
            total_tokens, token_estimated = stream_tokens, False
        else:
            total_tokens = estimate_tokens(request.message, full_text)
            token_estimated = True
        await UsageRepository(user.id).record(
            mode="single",
            message=request.message,
            selected_model=model_name or request.provider,
            success=completed and bool(full_text),
            total_tokens=total_tokens,
            token_estimated=token_estimated,
            chat_id=chat_link,
            billable=should_charge,
        )

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@router.post(
    "/chat/structured",
    response_model=StructuredChatResponse,
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def structured_chat(request: ChatRequest, user: User = Depends(current_user)):
    response = await ProviderService.generate_structured(
        message=request.message,
        provider_name=request.provider,
    )
    return StructuredChatResponse(structured_response=response)
