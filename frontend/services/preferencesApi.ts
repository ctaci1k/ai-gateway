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
