# backend/schemas/chat_schema.py

from typing import Literal

from pydantic import BaseModel, Field

from core.config import get_settings

# Configurable upper bound on a single user message (D-5 / limits).
_MAX_MESSAGE_LENGTH = get_settings().max_message_length

# Hard schema-level cap on transient dialogue history (P3/PH40) — a DoS guard on
# the request size. The route clamps further to the last N turns and truncates
# each message (see routes/chat.py); this is only the outer bound.
_MAX_HISTORY_MESSAGES = 100


class ChatTurn(BaseModel):
    """One prior message of the in-chat dialogue history (P3/PH40).

    Transit-only context the frontend replays so responders remember earlier
    turns within the SAME chat: for Compare the assistant turn is the winning
    answer the user saw. Never stored beyond the per-turn records the gateway
    already keeps; the route clamps the count and truncates each content."""

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ByokResponder(BaseModel):
    """One responder slot on a user's own API key (BYOK, PH17).

    ``slot`` matches a built-in responder ("groq"/"mistral"/"scout") or a
    custom added slot id. Default slots take the provider's fixed endpoint, so
    ``base_url`` is optional there; custom slots must supply it. Keys are used
    transiently for the request and never stored or logged (NQ5)."""

    slot: str = Field(min_length=1, max_length=64)
    base_url: str | None = None
    api_key: str = Field(min_length=1)
    model_id: str = Field(min_length=1, max_length=256)


class ByokJudge(BaseModel):
    """The judge slot on a user's own key (BYOK, PH17). Defaults to the Groq
    endpoint (the built-in judge runs on Groq)."""

    base_url: str | None = None
    api_key: str = Field(min_length=1)
    model_id: str = Field(min_length=1, max_length=256)


class ByokConfig(BaseModel):
    """Optional bring-your-own-key overrides for a single request (PH17, D-12).

    Transit-only: the gateway builds providers from these keys for the request
    and discards them. Never persisted, never logged."""

    judge: ByokJudge | None = None
    responders: list[ByokResponder] = Field(default_factory=list)


class ChatRequest(BaseModel):

    message: str = Field(
        min_length=1,
        max_length=_MAX_MESSAGE_LENGTH,
    )

    provider: str = Field(
        default="groq",
        min_length=1,
    )

    providers: list[str] | None = Field(default=None)

    compare_mode: bool = False

    selector_enabled: bool = False

    include_execution_metadata: bool = True

    include_selector_analysis: bool = True

    include_all_responses: bool = True

    manual_override: bool = False

    manually_selected_model: str | None = None

    # When set (Compare mode), the turn is also persisted to this saved chat
    # (PH9). Must belong to the requesting user. Single mode stays ephemeral.
    chat_id: int | None = None

    # RAG (PH10): ground responders in the user's uploaded documents.
    rag_enabled: bool = False

    # In-chat dialogue context (P3/PH40): prior turns of THIS chat the responders
    # should remember. Transit-only — the frontend assembles it from its own
    # state (Compare → the winning answer per turn). The route keeps only the
    # last N turns and truncates each message; new chat → empty. RAG/language
    # wrapping applies to the current message only, never to history; the judge
    # never receives it.
    history: list[ChatTurn] = Field(
        default_factory=list,
        max_length=_MAX_HISTORY_MESSAGES,
    )

    # UI locale (PH33/B3b, D-23): fallback language for the response when the
    # message language is ambiguous. Responders answer in the message language;
    # this only breaks ties. None → backend default (English). Judge untouched.
    locale: str | None = None

    # BYOK: DEPRECATED transit field (PH17). Since PH30 (D-20) keys are stored
    # server-side, ENCRYPTED, per-account, and the chat routes load them from the
    # DB by user_id — this body field is IGNORED. Kept optional for backward
    # compatibility; clients can no longer inject keys (a security plus too).
    byok: ByokConfig | None = None
