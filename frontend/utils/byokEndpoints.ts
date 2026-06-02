// frontend/utils/byokEndpoints.ts
//
// Curated catalogue of OpenAI-compatible base URLs offered for custom BYOK slots
// (PH29 / plan 027; simplified in PH29.1 per owner feedback). The base URL is a
// pick-from-list value — there is no free-text "Custom…" entry, and the built-in
// providers (Groq/Cerebras/SambaNova) are NOT listed here: the built-in judge and
// the default AI 1/2/3 slots use their fixed endpoint and have no base-URL field
// at all (you return to built-in via "Clear", not by picking it).
//
// Only custom AI 4/5 slots use this list, so it contains third-party,
// OpenAI chat/completions-compatible providers only. Verify each against the
// provider's docs before a release.
//
// Anthropic (Claude) is deliberately ABSENT: its API is not chat/completions
// compatible the way the rest are, so it cannot work through this BYOK path
// without a dedicated adapter (see plan 027, "Anthropic").

export interface ByokEndpoint {
  /** Provider label shown in the select option. */
  label: string;
  /** The OpenAI-compatible base URL passed to the backend as `base_url`. */
  url: string;
}

export const BYOK_BASE_URLS: readonly ByokEndpoint[] = [
  { label: "OpenAI", url: "https://api.openai.com/v1" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  { label: "Together AI", url: "https://api.together.xyz/v1" },
  { label: "Fireworks AI", url: "https://api.fireworks.ai/inference/v1" },
  { label: "DeepSeek", url: "https://api.deepseek.com" },
  { label: "Mistral", url: "https://api.mistral.ai/v1" },
  { label: "xAI (Grok)", url: "https://api.x.ai/v1" },
  {
    label: "Google Gemini (OpenAI-compatible)",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  { label: "Perplexity", url: "https://api.perplexity.ai" },
  { label: "Ollama (local)", url: "http://localhost:11434/v1" },
];

// The known endpoint matching `url` exactly, or null if it isn't in the list.
export function presetForUrl(url: string): ByokEndpoint | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return BYOK_BASE_URLS.find((e) => e.url === trimmed) ?? null;
}

// True when `url` is one of the curated endpoints.
export function isKnownUrl(url: string): boolean {
  return presetForUrl(url) !== null;
}
