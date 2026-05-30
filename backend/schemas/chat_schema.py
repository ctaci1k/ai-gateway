# backend/schemas/chat_schema.py

from pydantic import BaseModel, Field

from core.config import get_settings

# Configurable upper bound on a single user message (D-5 / limits).
_MAX_MESSAGE_LENGTH = get_settings().max_message_length


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
