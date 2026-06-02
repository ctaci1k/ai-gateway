// frontend/utils/byokEndpoints.ts
//
// Curated catalogue of OpenAI-compatible base URLs for BYOK (PH29, plan 027).
// The user no longer has to guess an endpoint: the form offers this verified
// list in a Select (+ "Custom…" for anything not listed). This is the single
// place a base URL string is duplicated — it mirrors the backend defaults
// (services/provider_service.py::DEFAULT_BASE_URLS) for the three built-ins.
//
// "builtin"     — our own responders (groq/cerebras/sambanova); their fixed
//                 endpoints, also offered as overrides.
// "compatible"  — third-party OpenAI chat/completions-compatible providers.
//                 Verify each against provider docs before a release.
//
// Anthropic (Claude) is deliberately ABSENT: its API is not chat/completions
// compatible the way the rest are, so it cannot work through this BYOK path
// without a dedicated adapter (see plan 027, "Anthropic").

export type ByokEndpointGroup = "builtin" | "compatible";

export interface ByokEndpoint {
  /** i18n-free provider label shown in the Select option. */
  label: string;
  /** The OpenAI-compatible base URL passed to the backend as `base_url`. */
  url: string;
  group: ByokEndpointGroup;
}

export const BYOK_BASE_URLS: readonly ByokEndpoint[] = [
  // Built-in / verified (our responders) — mirror backend DEFAULT_BASE_URLS.
  { label: "Groq", url: "https://api.groq.com/openai/v1", group: "builtin" },
  { label: "Cerebras", url: "https://api.cerebras.ai/v1", group: "builtin" },
  { label: "SambaNova", url: "https://api.sambanova.ai/v1", group: "builtin" },
  // Compatible (OpenAI-compatible third parties).
  { label: "OpenAI", url: "https://api.openai.com/v1", group: "compatible" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1", group: "compatible" },
  { label: "Together AI", url: "https://api.together.xyz/v1", group: "compatible" },
  { label: "Fireworks AI", url: "https://api.fireworks.ai/inference/v1", group: "compatible" },
  { label: "DeepSeek", url: "https://api.deepseek.com", group: "compatible" },
  { label: "Mistral", url: "https://api.mistral.ai/v1", group: "compatible" },
  { label: "xAI (Grok)", url: "https://api.x.ai/v1", group: "compatible" },
  {
    label: "Google Gemini (OpenAI-compatible)",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    group: "compatible",
  },
  { label: "Perplexity", url: "https://api.perplexity.ai", group: "compatible" },
  { label: "Ollama (local)", url: "http://localhost:11434/v1", group: "compatible" },
];

// The known endpoint matching `url` exactly, or null if it's a custom URL.
export function presetForUrl(url: string): ByokEndpoint | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return BYOK_BASE_URLS.find((e) => e.url === trimmed) ?? null;
}

// True when `url` is one of the curated endpoints (i.e. not a custom value).
export function isKnownUrl(url: string): boolean {
  return presetForUrl(url) !== null;
}
