// frontend/services/keysApi.ts
//
// BYOK key API. PH30 (D-20) moved keys to server-side ENCRYPTED, per-account
// storage (reversing D-12). The server returns only write-only metadata
// (last4) — never the key. `putKeys` validates each entry with a live call and
// stores only the working ones; `getKeys` hydrates metadata on login;
// `deleteKey` clears a slot. The legacy transit-only `validateKeys` is kept for
// reference but the save flow now goes through `putKeys`.

import { apiFetch, parseJsonResponse } from "@/services/apiClient";

// --- Legacy transit validation (PH17) --------------------------------------

export interface ValidateEntry {
  slot: string;
  base_url?: string;
  api_key: string;
  model_id: string;
  is_judge?: boolean;
}

export interface ValidateResult {
  slot: string;
  ok: boolean;
  error?: string | null;
}

export async function validateKeys(entries: ValidateEntry[]): Promise<ValidateResult[]> {
  const response = await apiFetch("/keys/validate", {
    method: "POST",
    body: { entries },
  });
  const data = await parseJsonResponse<{ results: ValidateResult[] }>(response);
  return data.results;
}

// --- Server-side storage (PH30, D-20) --------------------------------------

// Write-only metadata returned by the server (never the key, only last4).
export interface KeyMeta {
  slot: string;
  base_url: string;
  model_id: string;
  last4: string;
  custom: boolean;
}

// One slot to store. `api_key` omitted = keep the stored key (only metadata
// changes). `base_url` empty/omitted = built-in endpoint for a built-in slot.
export interface SaveEntry {
  slot: string;
  base_url?: string;
  model_id: string;
  api_key?: string;
  custom?: boolean;
}

export interface SaveResult {
  slot: string;
  ok: boolean;
  error?: string | null;
}

export interface SaveResponse {
  results: SaveResult[];
  keys: KeyMeta[];
}

// Hydrate the current user's stored key metadata (on login / settings open).
export async function getKeys(): Promise<KeyMeta[]> {
  const response = await apiFetch("/keys", { method: "GET" });
  const data = await parseJsonResponse<{ keys: KeyMeta[] }>(response);
  return data.keys;
}

// Validate + store the given entries; returns per-slot results + fresh metadata.
export async function putKeys(entries: SaveEntry[]): Promise<SaveResponse> {
  const response = await apiFetch("/keys", { method: "PUT", body: { entries } });
  return parseJsonResponse<SaveResponse>(response);
}

// Delete one stored slot; returns the remaining metadata.
export async function deleteKey(slot: string): Promise<KeyMeta[]> {
  const response = await apiFetch(`/keys/${encodeURIComponent(slot)}`, {
    method: "DELETE",
  });
  const data = await parseJsonResponse<{ keys: KeyMeta[] }>(response);
  return data.keys;
}

// --- Model discovery (PH30, D) ---------------------------------------------

export interface ModelInfo {
  id: string;
  is_chat: boolean;
}

export interface ModelsResult {
  models: ModelInfo[];
  // Set when discovery failed → the caller falls back to manual entry.
  error_reason: string | null;
}

export interface FetchModelsParams {
  slot?: string;
  baseUrl?: string;
  apiKey?: string;
}

// List the models an endpoint exposes (for the model combobox). Resolves the key
// from the typed value or — when omitted — the stored key for `slot`. Never
// throws on a provider error: returns `error_reason` so the UI shows manual entry.
export async function fetchModels({
  slot,
  baseUrl,
  apiKey,
}: FetchModelsParams): Promise<ModelsResult> {
  const response = await apiFetch("/keys/models", {
    method: "POST",
    body: {
      ...(slot ? { slot } : {}),
      ...(baseUrl ? { base_url: baseUrl } : {}),
      ...(apiKey ? { api_key: apiKey } : {}),
    },
  });
  return parseJsonResponse<ModelsResult>(response);
}
