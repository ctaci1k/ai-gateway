// frontend/services/keysApi.ts
//
// BYOK key validation (PH17). Posts each filled (base_url + key + model) to the
// backend, which makes one live test call per entry and returns per-slot
// ok/error. Nothing is stored server-side; keys live only in sessionStorage.

import { apiFetch, parseJsonResponse } from "@/services/apiClient";

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
