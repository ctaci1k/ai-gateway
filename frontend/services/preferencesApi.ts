// frontend/services/preferencesApi.ts

import { apiFetch, parseJsonResponse } from "@/services/apiClient";
import type { PersonalizationProfile } from "@/types/api";

export interface ManualSelectionParams {
  selectedModel: string;
  selectorModel?: string | null;
}

export interface ManualSelectionResult {
  success: boolean;
  personalization_profile: PersonalizationProfile;
}

// Record a manual model pick — trains personalization.
export async function postManualSelection({
  selectedModel,
  selectorModel,
}: ManualSelectionParams): Promise<ManualSelectionResult> {
  const response = await apiFetch("/preferences/manual-selection", {
    method: "POST",
    body: {
      selected_model: selectedModel,
      selector_model: selectorModel ?? null,
    },
  });
  return parseJsonResponse<ManualSelectionResult>(response);
}

// ---- Judge-prompt override (PH24, E2) ----

export interface JudgePrompt {
  // The user's custom judge prompt, or null when using the built-in default.
  override: string | null;
  // The built-in default template (read-only) shown in the editor / used to reset.
  default: string;
}

export async function getJudgePrompt(): Promise<JudgePrompt> {
  const response = await apiFetch("/preferences/judge-prompt");
  return parseJsonResponse<JudgePrompt>(response);
}

// Save the override; pass null to reset to the built-in default.
export async function putJudgePrompt(override: string | null): Promise<JudgePrompt> {
  const response = await apiFetch("/preferences/judge-prompt", {
    method: "PUT",
    body: { override },
  });
  return parseJsonResponse<JudgePrompt>(response);
}
