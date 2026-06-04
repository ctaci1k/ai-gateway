// frontend/utils/byokEndpoints.ts
//
// Curated catalogue of OpenAI-compatible base URLs offered in the BYOK base-URL
// <select> (PH29 / plan 027; reworked PH30). The base URL is a pick-from-list
// value — no free-text entry.
//
// PH30 UX fix: the built-in providers (Groq/Mistral; slot 3 is a second Groq
// model since PH36/D-26) are part of the catalogue and SELECTABLE, so the dropdown matches the "where to get keys"
// directory. For each built-in slot its OWN provider is the named DEFAULT option
// (empty value → that provider's endpoint, e.g. "Groq · default endpoint"); the
// other two built-ins + all compatibles are listed as override targets
// (selectableEndpointsForSlot). Custom slots (AI 4/5) offer every provider.
//
// The directory + contextual ⓘ links reuse the same entries (`keysUrl` /
// `modelsUrl` / `needsKey`). External navigation only opens provider docs — NO
// keys/data ever leave the app (D-12/D-20 untouched). No logos (owner decision).
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
  /** False when no key is needed (a no-auth provider). */
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

// The built-in providers (the app's own keys back these by default). Their base
// URLs mirror backend provider_service.DEFAULT_BASE_URLS. PH30 (E/fix): they are
// now SELECTABLE in the base-URL dropdown too — each built-in slot offers its OWN
// provider as the named default ("Groq · default endpoint") and the OTHER two as
// options, matching the "where to get keys" directory.
export const BUILTIN_BASE_URLS: readonly ByokEndpoint[] = [
  {
    id: "groq",
    label: "Groq",
    url: "https://api.groq.com/openai/v1",
    keysUrl: "https://console.groq.com/keys",
    modelsUrl: "https://console.groq.com/docs/models",
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
];

// Third-party OpenAI-compatible providers (not backed by the app's keys).
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
    id: "xai",
    label: "xAI (Grok)",
    url: "https://api.x.ai/v1",
    keysUrl: "https://console.x.ai",
    modelsUrl: "https://docs.x.ai/docs/models",
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
    // Gemini's OpenAI-compatible endpoint. No longer a built-in slot (its free
    // tier is geo-blocked in the EEA, PH36/D-26), but still offered for BYOK so a
    // user with their own (paid) Gemini key can use it.
    id: "gemini",
    label: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    keysUrl: "https://aistudio.google.com/apikey",
    modelsUrl: "https://ai.google.dev/gemini-api/docs/models",
    needsKey: true,
  },
];

// Every selectable endpoint: built-ins first, then third-party compatibles.
export const ALL_ENDPOINTS: readonly ByokEndpoint[] = [...BUILTIN_BASE_URLS, ...BYOK_BASE_URLS];

// Built-in provider links keyed by slot id (single source = BUILTIN_BASE_URLS).
export const BUILTIN_PROVIDER_LINKS: Readonly<Record<string, ProviderLinks>> = Object.fromEntries(
  BUILTIN_BASE_URLS.map((e) => [e.id, toLinks(e)]),
);

function toLinks(e: ByokEndpoint): ProviderLinks {
  return {
    id: e.id,
    label: e.label,
    keysUrl: e.keysUrl,
    modelsUrl: e.modelsUrl,
    needsKey: e.needsKey,
  };
}

// The known endpoint matching `url` exactly (built-in or compatible), else null.
export function presetForUrl(url: string): ByokEndpoint | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return ALL_ENDPOINTS.find((e) => e.url === trimmed) ?? null;
}

// True when `url` is one of the known endpoints.
export function isKnownUrl(url: string): boolean {
  return presetForUrl(url) !== null;
}

// The built-in provider that backs a slot by default: the 3 default responders +
// the judge (Groq). Returns null for custom slots. Its base URL is the slot's
// "default endpoint" (an empty stored base_url resolves to it server-side).
export function builtinForSlot(slot: string): ByokEndpoint | null {
  // The judge and slot 3 (scout, a second Groq model — PH36/D-26) both default to
  // Groq's endpoint; their slot id is not itself a catalogue entry.
  if (slot === "byok-judge" || slot === "scout")
    return BUILTIN_BASE_URLS.find((e) => e.id === "groq") ?? null;
  return BUILTIN_BASE_URLS.find((e) => e.id === slot) ?? null;
}

// Endpoints to OFFER in a slot's base-URL <select>. For a built-in slot the
// slot's own provider is the (named) default option, so it's excluded from the
// list — the OTHER two built-ins + all compatibles remain selectable (overrides).
// Custom slots offer every endpoint and must pick one.
export function selectableEndpointsForSlot(slot: string, custom: boolean): readonly ByokEndpoint[] {
  if (custom) return ALL_ENDPOINTS;
  const own = builtinForSlot(slot);
  return own ? ALL_ENDPOINTS.filter((e) => e.id !== own.id) : ALL_ENDPOINTS;
}

// Provider links for a chosen base URL (built-in or compatible), or null.
export function providerLinksForUrl(url: string): ProviderLinks | null {
  const preset = presetForUrl(url);
  return preset ? toLinks(preset) : null;
}

// Provider links for a built-in slot (default responders + judge on Groq), or
// null for unknown / custom slots.
export function providerLinksForSlot(slot: string): ProviderLinks | null {
  const builtin = builtinForSlot(slot);
  return builtin ? toLinks(builtin) : null;
}

// Every provider for the global directory: built-ins first, then compatibles.
export const ALL_PROVIDER_LINKS: readonly ProviderLinks[] = ALL_ENDPOINTS.map(toLinks);
