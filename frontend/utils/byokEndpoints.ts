// frontend/utils/byokEndpoints.ts
//
// Curated catalogue of OpenAI-compatible base URLs offered for custom BYOK slots
// (PH29 / plan 027; simplified in PH29.1). The base URL is a pick-from-list value
// — no free-text entry — and the built-in providers (Groq/Cerebras/SambaNova) are
// NOT listed here: the built-in judge and default AI 1/2/3 slots use their fixed
// endpoint (you return to it via "Clear").
//
// PH30 (plan 028, Block E) adds the "where to get keys & models" directory: each
// entry carries `keysUrl` / `modelsUrl` (+ `needsKey`), and a separate
// BUILTIN_PROVIDER_LINKS map covers Groq/Cerebras/SambaNova (absent from the list
// above). Helpers resolve the right links from a base URL or a slot. External
// navigation only opens provider docs — NO keys/data ever leave the app (D-12/
// D-20 untouched). No logos (owner decision).
//
// ⚠️ Provider docs URLs drift — VERIFY each against the provider before a release.
//
// Anthropic (Claude) is deliberately ABSENT: its API is not chat/completions
// compatible the way the rest are (see plan 027, "Anthropic").

export interface ByokEndpoint {
  /** Stable id (for keys/lookup). */
  id: string;
  /** Provider label shown in the select option / directory. */
  label: string;
  /** The OpenAI-compatible base URL passed to the backend as `base_url`. */
  url: string;
  /** Page where the user creates an API key. */
  keysUrl: string;
  /** Page listing the provider's available models. */
  modelsUrl: string;
  /** False when no key is needed (local Ollama). */
  needsKey: boolean;
}

// Resolved links for the directory / contextual ⓘ (subset shared with built-ins).
export interface ProviderLinks {
  id: string;
  label: string;
  keysUrl: string;
  modelsUrl: string;
  needsKey: boolean;
}

export const BYOK_BASE_URLS: readonly ByokEndpoint[] = [
  {
    id: "openai",
    label: "OpenAI",
    url: "https://api.openai.com/v1",
    keysUrl: "https://platform.openai.com/api-keys",
    modelsUrl: "https://platform.openai.com/docs/models",
    needsKey: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1",
    keysUrl: "https://openrouter.ai/keys",
    modelsUrl: "https://openrouter.ai/models",
    needsKey: true,
  },
  {
    id: "together",
    label: "Together AI",
    url: "https://api.together.xyz/v1",
    keysUrl: "https://api.together.xyz/settings/api-keys",
    modelsUrl: "https://docs.together.ai/docs/inference-models",
    needsKey: true,
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    url: "https://api.fireworks.ai/inference/v1",
    keysUrl: "https://fireworks.ai/account/api-keys",
    modelsUrl: "https://fireworks.ai/models",
    needsKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    url: "https://api.deepseek.com",
    keysUrl: "https://platform.deepseek.com/api_keys",
    modelsUrl: "https://api-docs.deepseek.com/quick_start/pricing",
    needsKey: true,
  },
  {
    id: "mistral",
    label: "Mistral",
    url: "https://api.mistral.ai/v1",
    keysUrl: "https://console.mistral.ai/api-keys",
    modelsUrl: "https://docs.mistral.ai/getting-started/models/models_overview/",
    needsKey: true,
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    url: "https://api.x.ai/v1",
    keysUrl: "https://console.x.ai",
    modelsUrl: "https://docs.x.ai/docs/models",
    needsKey: true,
  },
  {
    id: "gemini",
    label: "Google Gemini (OpenAI-compatible)",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    keysUrl: "https://aistudio.google.com/apikey",
    modelsUrl: "https://ai.google.dev/gemini-api/docs/models",
    needsKey: true,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    url: "https://api.perplexity.ai",
    keysUrl: "https://www.perplexity.ai/settings/api",
    modelsUrl: "https://docs.perplexity.ai/getting-started/models",
    needsKey: true,
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    url: "http://localhost:11434/v1",
    keysUrl: "",
    modelsUrl: "https://ollama.com/library",
    needsKey: false,
  },
];

// Built-in providers (the app's own keys back these by default). Not in the
// catalogue above, but the directory + contextual links cover them too.
export const BUILTIN_PROVIDER_LINKS: Readonly<Record<string, ProviderLinks>> = {
  groq: {
    id: "groq",
    label: "Groq",
    keysUrl: "https://console.groq.com/keys",
    modelsUrl: "https://console.groq.com/docs/models",
    needsKey: true,
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras",
    keysUrl: "https://cloud.cerebras.ai",
    modelsUrl: "https://inference-docs.cerebras.ai/api-reference/models",
    needsKey: true,
  },
  sambanova: {
    id: "sambanova",
    label: "SambaNova",
    keysUrl: "https://cloud.sambanova.ai/apis",
    modelsUrl: "https://docs.sambanova.ai/cloud/docs/get-started/supported-models",
    needsKey: true,
  },
};

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

function toLinks(e: ByokEndpoint): ProviderLinks {
  return {
    id: e.id,
    label: e.label,
    keysUrl: e.keysUrl,
    modelsUrl: e.modelsUrl,
    needsKey: e.needsKey,
  };
}

// Provider links for a chosen base URL (a custom slot), or null when unknown.
export function providerLinksForUrl(url: string): ProviderLinks | null {
  const preset = presetForUrl(url);
  return preset ? toLinks(preset) : null;
}

// Provider links for a built-in slot: the 3 default responders + the judge
// (which runs on Groq by default). Returns null for unknown / custom slots.
export function providerLinksForSlot(slot: string): ProviderLinks | null {
  if (slot === "byok-judge") return BUILTIN_PROVIDER_LINKS.groq;
  return BUILTIN_PROVIDER_LINKS[slot] ?? null;
}

// Every provider for the global directory: built-ins first, then compatibles.
export const ALL_PROVIDER_LINKS: readonly ProviderLinks[] = [
  ...Object.values(BUILTIN_PROVIDER_LINKS),
  ...BYOK_BASE_URLS.map(toLinks),
];
