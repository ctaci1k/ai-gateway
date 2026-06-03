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
  // PH32 (D-22): True when this slot ran on the user's own (BYOK) key. Persisted
  // with the turn so the replayed banner/cards are self-describing (no current-
  // keys lookup). Absent on pre-PH32 saved turns → treated as false.
  is_byok?: boolean;
}

export type FailureReason =
  | "rate_limited"
  | "timeout"
  | "empty_response"
  | "length_exceeded"
  | "unavailable";

export interface FailedProvider {
  provider: string;
  error: string | null;
  reason?: FailureReason | null;
  // PH32 (D-22): the failed responder's real model id + key source, so the
  // replayed failed card is self-describing.
  model?: string | null;
  is_byok?: boolean;
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
  // PH32 (D-22): key source of this slot on the saved turn → drives the truthful
  // card label on replay without consulting the current keys.
  is_byok?: boolean;
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

// PH24 (D-17): chats carry a mode; Single chats are bound to one model.
export type ChatMode = "single" | "compare";

export interface ChatSummary {
  id: number;
  title: string;
  mode: ChatMode;
  // The responder slot for a Single chat (fixed at creation); null for Compare.
  model: string | null;
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
  // Live limit windows (PH17). Per-dimension fields are null when that
  // dimension is unlimited (admin / null limit). The minute window opens with
  // the first request; minute_resets_in_seconds counts down to its reset. The
  // day resets at 00:00 Europe/Warsaw (day_resets_at, ISO-8601 UTC).
  remaining_this_minute: number | null;
  minute_resets_in_seconds: number | null;
  day_resets_at: string | null;
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
  // PH32 (D-22): the REAL model that answered/won (selected_model stays the slot);
  // null → fall back to the slot label.
  model_name: string | null;
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

// --- Usage Reports (PH27, D-18) — per-user /reports/* ----------------------

export interface ReportSummary {
  total_requests: number;
  total_tokens: number;
  // True when any counted token figure in the window is an estimate.
  tokens_estimated: boolean;
  by_mode: Record<string, number>; // { single, compare }
  billable_vs_own: Record<string, number>; // { billable, own_key }
  distinct_chats: number;
  success_rate: number; // 0..1
  first_event: string | null;
  last_event: string | null;
}

export interface ModelUsage {
  model: string | null;
  // PH31 (D-21): masked BYOK key behind this model (first4••••last4); null =
  // the built-in app key. The same model splits into separate rows by key source.
  key_fingerprint: string | null;
  // PH32 (D-22): the REAL model that answered; null → fall back to the slot label.
  model_name: string | null;
  // PH34 (D-24, B9b): "responder" (a winning row) or "judge" (a derived own-key
  // judge row, shown so the added judge is visible even in Compare).
  role: "responder" | "judge";
  requests: number;
  total_tokens: number;
  successful: number;
}

export interface ChatUsage {
  // null = the deleted/ad-hoc bucket.
  chat_id: number | null;
  title: string | null;
  mode: ChatMode | null;
  model: string | null;
  // PH32 (D-22): a representative REAL model for the chat; null → slot fallback.
  model_name: string | null;
  requests: number;
  total_tokens: number;
  last_event: string | null;
}

export interface TimeseriesPoint {
  bucket: string; // naive-UTC ISO
  requests: number;
  tokens: number;
}

export interface TimeseriesResponse {
  bucket: "day" | "hour";
  points: TimeseriesPoint[];
}

// Access-key filter (PH28): app = built-in keys (billable), own = BYOK.
export type ReportAccess = "app" | "own";

export interface BreakdownChat {
  chat_id: number | null;
  title: string | null;
  mode: ChatMode | null;
  requests: number;
  total_tokens: number;
}

export interface BreakdownModel {
  model: string | null;
  // PH31 (D-21): masked BYOK key behind this model node; null = built-in.
  key_fingerprint: string | null;
  // PH32 (D-22): the REAL model for this node; null → fall back to the slot label.
  model_name: string | null;
  // PH34 (D-24, B9b): "responder" or "judge" (a derived own-key judge node).
  role: "responder" | "judge";
  requests: number;
  total_tokens: number;
  chats: BreakdownChat[];
}

export interface BreakdownGroup {
  access_key: "app" | "own";
  requests: number;
  total_tokens: number;
  models: BreakdownModel[];
}

export interface BreakdownResponse {
  groups: BreakdownGroup[];
}

// One row of the per-user activity log (richer than the admin UsageEventRecord).
export interface ReportEvent {
  id: number;
  created_at: string;
  mode: string;
  model: string | null;
  // PH32 (D-22): the REAL model that answered this turn; null → slot fallback.
  model_name: string | null;
  total_tokens: number | null;
  token_estimated: boolean;
  success: boolean;
  billable: boolean;
  // PH31 (D-21): masked BYOK key used for this turn's model; null = built-in.
  key_fingerprint: string | null;
  // PH34 (D-24, B9b): the added (BYOK) judge for this turn, inline; null = a
  // built-in / no judge. Shown as a small secondary badge in the activity log.
  judge_model_name: string | null;
  judge_key_fingerprint: string | null;
  message: string;
  chat_id: number | null;
  chat_title: string | null;
}

export interface ReportEventsPage {
  events: ReportEvent[];
  next_cursor: string | null;
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
  // Classified failure reason (PH18/8, D-13) so the UI can tell a BYOK key's own
  // provider rate-limit apart from our account quota. Absent on older payloads.
  reason?: FailureReason | null;
}

// Terminal event carrying RAG grounding for a Single+RAG stream (PH13/C3).
export interface StreamSourcesEvent {
  type: "sources";
  sources: RagSource[];
}

export type StreamEvent = StreamTokenEvent | StreamErrorEvent | StreamSourcesEvent;
