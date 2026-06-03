// frontend/components/keys/ModelCombobox.tsx
//
// Model picker for a BYOK slot (PH30/D; select-only in PH30.2). The model id is
// chosen from a <select> populated by discovery (POST /keys/models, server-side
// so the key never reaches a third party from the browser) — NO free typing in
// the normal case.
//
// Smart manual fallback (the plan's "never block" guard, gated by the failure
// reason so a bad key can't unlock free typing):
//   - 404 `no_models` (provider has no /models, e.g. Perplexity) OR an empty list
//     on a valid key → a manual <input> appears so the slot stays usable;
//   - 401/403 `bad_key` → stay select-only + "check your key" (the real fix);
//   - 429 / timeout / network → stay select-only + "try again".
// Large lists get the heuristic chat filter + a "show all" toggle. Results are
// cached per (endpoint + key) for the session. Live validation on Save still
// applies (picking from the list isn't a guarantee it works).

"use client";

import { useCallback, useState } from "react";

import { fetchModels, type ModelInfo } from "@/services/keysApi";
import { useI18n } from "@/store/LanguageContext";

interface ModelComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  placeholder: string;
  // Discovery params: the slot + the row's current endpoint/key + whether a key
  // is already stored server-side (so we can list without re-typing the key).
  slot?: string;
  baseUrl: string;
  apiKey: string;
  stored: boolean;
}

type Status = "idle" | "loading" | "loaded" | "error";

// Dedupe discovered models at the DATA level (B6/D-23): some providers list the
// same model id more than once (e.g. trailing whitespace or case variants). We
// normalize by trimmed, lower-cased id and keep the FIRST occurrence, so both the
// rendered <select> options and their React keys stay unique (no duplicate-key
// warning). Exported for unit testing.
export function dedupeModels(models: ModelInfo[]): ModelInfo[] {
  const seen = new Set<string>();
  const out: ModelInfo[] = [];
  for (const m of models) {
    const norm = m.id.trim().toLowerCase();
    if (norm === "" || seen.has(norm)) continue;
    seen.add(norm);
    out.push(m);
  }
  return out;
}

// Session cache of discovered models, keyed by endpoint + key identity.
const cache = new Map<string, ModelInfo[]>();
function cacheKey(baseUrl: string, apiKey: string, slot: string | undefined): string {
  return `${baseUrl}|${apiKey ? `k:${apiKey}` : `stored:${slot ?? ""}`}`;
}

export default function ModelCombobox({
  id,
  value,
  onChange,
  invalid,
  placeholder,
  slot,
  baseUrl,
  apiKey,
  stored,
}: ModelComboboxProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Can we list? We need a key — typed now or already stored server-side.
  const canLoad = apiKey.trim() !== "" || stored;

  const load = useCallback(async () => {
    const key = cacheKey(baseUrl.trim(), apiKey.trim(), slot);
    const cached = cache.get(key);
    if (cached) {
      setModels(cached);
      setStatus("loaded");
      setReason(null);
      return;
    }
    setStatus("loading");
    setReason(null);
    try {
      const result = await fetchModels({
        slot,
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      if (result.error_reason) {
        setReason(result.error_reason);
        setModels([]);
        setStatus("error");
        return;
      }
      const deduped = dedupeModels(result.models);
      cache.set(key, deduped);
      setModels(deduped);
      setStatus("loaded");
    } catch {
      setReason("unavailable");
      setModels([]);
      setStatus("error");
    }
  }, [baseUrl, apiKey, slot]);

  const chatModels = models.filter((m) => m.is_chat);
  const hiddenCount = models.length - chatModels.length;
  const visible = showAll ? models : chatModels;

  // Manual entry is unlocked ONLY when the provider genuinely has no /models
  // (404) or returned an empty list on a valid key — never on a bad key (401/403).
  const manual =
    (status === "error" && reason === "no_models") || (status === "loaded" && models.length === 0);

  // The current value may not be in the (filtered) list — keep it selectable so a
  // saved/prefilled model id always shows.
  const valueMissing = value !== "" && !visible.some((m) => m.id === value);

  const fieldClass = invalid
    ? "keys-input keys-input--model keys-input--invalid"
    : "keys-input keys-input--model";

  return (
    <div className="keys-model">
      <div className="keys-model-row">
        {manual ? (
          <input
            id={id}
            className={fieldClass}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <select
            id={id}
            className={fieldClass}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{t("keys.selectModel")}</option>
            {valueMissing && <option value={value}>{value}</option>}
            {visible.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="keys-model-load"
          disabled={!canLoad || status === "loading"}
          onClick={() => void load()}
        >
          {status === "loading" ? t("keys.loadingModels") : t("keys.loadModels")}
        </button>
      </div>

      {status === "loaded" && models.length > 0 && (
        <p className="keys-hint">
          {t("keys.modelsFound", { n: visible.length })}
          {hiddenCount > 0 && (
            <>
              {" "}
              <button
                type="button"
                className="keys-link-btn"
                aria-pressed={showAll}
                onClick={() => setShowAll((s) => !s)}
              >
                {showAll ? t("keys.showChatOnly") : t("keys.showAllModels", { n: hiddenCount })}
              </button>
            </>
          )}
        </p>
      )}
      {manual && <p className="keys-hint">{t("keys.noModelsManual")}</p>}
      {status === "error" && reason === "bad_key" && (
        <p className="keys-hint">{t("keys.models.badKey")}</p>
      )}
      {status === "error" && reason !== "bad_key" && reason !== "no_models" && (
        <p className="keys-hint">{t("keys.models.retry")}</p>
      )}
    </div>
  );
}
