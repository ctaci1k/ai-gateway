// frontend/types/api.ts
//
// Real domain types mirroring the backend response contract
// (backend/schemas/chat_response.py, docs/04-data-models.md).

export interface ProviderResponse {
  response: string;
  model: string;
  execution_time: number;
  provider: string;
  success: boolean;
}

export type FailureReason = "rate_limited" | "timeout" | "empty_response" | "unavailable";

export interface FailedProvider {
  provider: string;
  error: string | null;
  reason?: FailureReason | null;
}

export interface ExecutionMetadataItem {
  provider: string;
  success: boolean;
  execution_time: number;
  model: string | null;
  error: string | null;
}

export interface ExecutionSummary {
  total_models: number;
  successful_models: number;
  failed_models: number;
  average_execution_time: number;
}

// Concrete reason the rule-based fallback ran (PH13/D); null when the judge
// decided. Mirrors backend FALLBACK_* codes in selector/response_selector.py.
export type FallbackReason = "judge_unavailable" | "invalid_response" | "low_confidence";

export interface SelectorMetadata {
  selector_provider?: string | null;
  selector_model?: string | null;
  selector_confidence?: number;
  fallback_used?: boolean;
  fallback_reason?: FallbackReason | null;
  selected_model?: string | null;
  selection_reason?: string | null;
  scores?: Record<string, number>;
  personalization_enabled?: boolean;
}

export interface PersonalizationProfile {
  preferred_models: Record<string, number>;
  manual_model_selections: Record<string, number>;
  response_style_preferences: Record<string, unknown>;
  favorite_response_style: string | null;
  response_interactions: Record<string, number>;
}

export interface RagSource {
  document_id: number | null;
  filename: string | null;
  chunk_index: number | null;
  score: number | null;
  snippet: string | null;
}

export interface ChatResponse {
  response: string;
  selected_model: string | null;
  selected_model_data: ProviderResponse | null;
  all_responses: Record<string, ProviderResponse>;
  failed_providers: FailedProvider[];
  execution_metadata: ExecutionMetadataItem[];
  execution_summary: Partial<ExecutionSummary>;
  compare_mode: boolean;
  selector_enabled: boolean;
  selector_scores: Record<string, number>;
  selector_metadata: SelectorMetadata;
  selector_reason: string | null;
  compare_summary: Record<string, unknown>;
  comparison_count: number;
  personalization_profile: PersonalizationProfile;
  personalization_enabled: boolean;
  manual_override: boolean;
  manually_selected_model: string | null;
  rag_enabled: boolean;
  rag_sources: RagSource[];
}

// Uploaded RAG document (PH10).
export interface DocumentSummary {
  id: number;
  filename: string;
  content_type: string;
  chunk_count: number;
  created_at: string;
}

// View model for a single column in the compare UI (derived from ChatResponse).
export interface CompareRow {
  provider: string;
  model: string;
  response: string;
  executionTime: number;
  score: number;
  confidence: number;
}

// ---- Saved Compare chats (PH9) ----

// One persisted Compare turn (backend build_interaction_record shape).
export interface SavedInteraction {
  user_message: string;
  best_response: string;
  selected_model: string | null;
  all_responses: Record<string, ProviderResponse>;
  failed_providers?: FailedProvider[];
  selector_scores: Record<string, number>;
  selector_metadata: SelectorMetadata;
  selector_reason: string | null;
  compare_mode: boolean;
  manual_override: boolean;
  manually_selected_model: string | null;
}

export interface ChatMessageRecord {
  id: number;
  created_at: string;
  payload: SavedInteraction;
}

export interface ChatSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatDetail extends ChatSummary {
  messages: ChatMessageRecord[];
}

// ---- Auth / admin / quotas (PH15, D-10) ----

// /auth/me payload: identity + admin flag + rolling quota state. Limits are
// null for unlimited accounts (admins); remaining_today is null when unlimited.
export interface CurrentUser {
  id: number;
  username: string;
  is_admin: boolean;
  max_requests_per_minute: number | null;
  max_requests_per_day: number | null;
  used_this_minute: number;
  used_today: number;
  remaining_today: number | null;
}

// A user row in the admin table (identity + quotas + current usage).
export interface AdminUserSummary {
  id: number;
  username: string;
  is_admin: boolean;
  max_requests_per_minute: number | null;
  max_requests_per_day: number | null;
  used_this_minute: number;
  used_today: number;
  remaining_today: number | null;
  created_at: string;
}

// One append-only usage event in the admin audit view.
export interface UsageEventRecord {
  id: number;
  created_at: string;
  mode: string;
  message: string;
  selected_model: string | null;
  total_tokens: number | null;
  success: boolean;
}

export interface AdminUserUsage {
  user: AdminUserSummary;
  events: UsageEventRecord[];
  total_requests: number;
  total_tokens: number;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  is_admin?: boolean;
  max_requests_per_minute?: number | null;
  max_requests_per_day?: number | null;
}

export interface UpdateUserPayload {
  is_admin?: boolean;
  max_requests_per_minute?: number | null;
  max_requests_per_day?: number | null;
}

// Stream events from POST /chat/stream (NDJSON).
export interface StreamTokenEvent {
  type: "token";
  content: string;
  provider: string;
  model: string;
}

export interface StreamErrorEvent {
  type: "error";
  content: string;
}

// Terminal event carrying RAG grounding for a Single+RAG stream (PH13/C3).
export interface StreamSourcesEvent {
  type: "sources";
  sources: RagSource[];
}

export type StreamEvent = StreamTokenEvent | StreamErrorEvent | StreamSourcesEvent;
