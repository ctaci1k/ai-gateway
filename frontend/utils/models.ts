// frontend/utils/models.ts
//
// Truthful display names for the responder models (PH16, D-11). The backend is
// the single source of truth (config/models_config.py); this constant mirrors
// it the same way utils/judge.ts mirrors SELECTOR_MODEL, so the UI can label a
// provider before any /chat response arrives (e.g. the Single model switcher).
// Keep in sync with the backend registry.

export const RESPONDER_LABELS: Readonly<Record<string, string>> = {
  groq: "Llama 3.3 70B",
  cerebras: "GLM-4.7",
  sambanova: "DeepSeek V3.1",
};

// Friendly label for a responder provider key; falls back to the raw key for
// any provider not in the registry.
export function responderLabel(provider: string): string {
  return RESPONDER_LABELS[provider] ?? provider;
}

// Truthful model name for any HISTORICAL / report surface (PH32, D-22). The
// single source of truth for "what model really answered", BYOK-aware:
//   - built-in (isByok=false)        → the friendly slot label (Llama / GLM / …)
//   - own key  (isByok=true)         → the real model id (e.g. gpt-4o)
//   - legacy own-key row without the
//     real model (model null)        → falls back to the slot label
// ``slot`` is the routing identity (selected_model / responder key); ``model`` is
// the denormalized real model (usage_events.model_name, or all_responses.model on
// a replayed turn). Composer / active-model surfaces deliberately do NOT use this
// — they show what you'll send with the CURRENT keys (byokModelId), which is
// correct, not a gap (D-22).
export function modelDisplay(
  slot: string | null,
  model: string | null | undefined,
  isByok: boolean,
): string {
  if (isByok && model) return model;
  if (slot) return responderLabel(slot);
  return model || "—";
}
