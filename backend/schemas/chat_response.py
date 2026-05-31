# backend/schemas/chat_response.py
"""Typed response models for the chat / compare endpoints (B5).

Leaf shapes that are stable are strongly typed; free-form metadata blocks
(selector_metadata, personalization_profile, scores, summaries) pass through as
dicts to avoid silently dropping fields.
"""

from typing import Any

from pydantic import BaseModel


class ProviderResponse(BaseModel):
    response: str
    model: str
    execution_time: float
    provider: str
    success: bool


class FailedProvider(BaseModel):
    provider: str
    error: str | None = None
    # Stable reason code (PH13): rate_limited / timeout / empty_response /
    # unavailable. Lets the UI show a localized reason in the failed column.
    reason: str | None = None


class ExecutionMetadataItem(BaseModel):
    provider: str
    success: bool
    execution_time: float
    model: str | None = None
    error: str | None = None


class RagSource(BaseModel):
    document_id: int | None = None
    filename: str | None = None
    chunk_index: int | None = None
    score: float | None = None
    snippet: str | None = None


class ChatResponse(BaseModel):
    response: str
    selected_model: str | None
    selected_model_data: ProviderResponse | None
    all_responses: dict[str, ProviderResponse]
    failed_providers: list[FailedProvider]
    execution_metadata: list[ExecutionMetadataItem]
    execution_summary: dict[str, Any]
    compare_mode: bool
    selector_enabled: bool
    selector_scores: dict[str, Any]
    selector_metadata: dict[str, Any]
    selector_reason: str | None
    compare_summary: dict[str, Any]
    comparison_count: int = 0
    personalization_profile: dict[str, Any]
    personalization_enabled: bool
    manual_override: bool
    manually_selected_model: str | None
    rag_enabled: bool = False
    rag_sources: list[RagSource] = []


class StructuredChatResponse(BaseModel):
    structured_response: Any


class ManualSelectionResponse(BaseModel):
    success: bool
    personalization_profile: dict[str, Any]


class ProvidersResponse(BaseModel):
    providers: list[str]


class ProviderInfo(BaseModel):
    provider: str
    model: str
    # Truthful human label for the model (PH16, D-11), e.g. "Llama 3.3 70B".
    display_name: str
    supports_streaming: bool
    supports_structured_output: bool
    supports_tool_calling: bool
    supports_vision: bool
    supports_selector_execution: bool
    max_context_window: int


class ProvidersInfoResponse(BaseModel):
    providers: list[ProviderInfo]


class MemoryResponse(BaseModel):
    memory: list[dict[str, Any]]


class PreferencesResponse(BaseModel):
    preferences: dict[str, Any]
    personalization_profile: dict[str, Any]
