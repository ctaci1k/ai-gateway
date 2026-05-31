# backend/schemas/chat_schema.py

from pydantic import BaseModel, Field

from core.config import get_settings

# Configurable upper bound on a single user message (D-5 / limits).
_MAX_MESSAGE_LENGTH = get_settings().max_message_length


class ByokResponder(BaseModel):
    """One responder slot on a user's own API key (BYOK, PH17).

    ``slot`` matches a built-in responder ("groq"/"cerebras"/"sambanova") or a
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

    # BYOK (PH17): optional per-request keys for responders / judge. When a
    # participant runs on the user's own key the turn isn't charged against the
    # account quota (Single: free if the chosen model is BYOK; Compare: free
    # only if every participant is BYOK).
    byok: ByokConfig | None = None
