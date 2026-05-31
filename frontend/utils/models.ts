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
