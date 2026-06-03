// frontend/components/keys/ModelCombobox.tsx
//
// Model-id combobox for a BYOK slot (PH30/D, model discovery). Built on a native
// <input list> + <datalist>, which gives a MANUAL fallback for free: the user
// can always type any model id, even when discovery is unavailable.
//
// "Load models" calls POST /keys/models (server-side, so the key never reaches
// a third party from the browser) and fills the datalist. Three safeguards:
//   (a) large lists → the native datalist already does typeahead filtering;
//   (b) /models includes non-chat models → a heuristic chat filter + a
//       "show all" toggle (the server tags each id with is_chat);
//   (c) no /models / error → a readable reason, and manual entry still works.
// Results are cached per (endpoint + key) for the session. Live validation on
// Save still applies (picking from the list isn't a guarantee it works).

"use client";

import { useCallback, useId, useState } from "react";

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

// Session cache of discovered models, keyed by endpoint + key identity.
const cache = new Map<string, ModelInfo[]>();
function cacheKey(baseUrl: string, apiKey: string, slot: string | undefined): string {
  return `${baseUrl}|${apiKey ? `k:${apiKey}` : `stored:${slot ?? ""}`}`;
}

// Map a backend failure reason to an existing, readable i18n message.
const REASON_KEY: Record<string, string> = {
  rate_limited: "compare.fail.rateLimited",
  timeout: "compare.fail.timeout",
  empty_response: "compare.fail.emptyResponse",
  unavailable: "compare.fail.unavailable",
};

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
  const listId = useId();
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
        setStatus("error");
        return;
      }
      cache.set(key, result.models);
      setModels(result.models);
      setStatus("loaded");
    } catch {
      setReason("unavailable");
      setStatus("error");
    }
  }, [baseUrl, apiKey, slot]);

  const chatModels = models.filter((m) => m.is_chat);
  const hiddenCount = models.length - chatModels.length;
  const visible = showAll ? models : chatModels;

  return (
    <div className="keys-model">
      <div className="keys-model-row">
        <input
          id={id}
          className={
            invalid
              ? "keys-input keys-input--model keys-input--invalid"
              : "keys-input keys-input--model"
          }
          list={listId}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="keys-model-load"
          disabled={!canLoad || status === "loading"}
          onClick={() => void load()}
        >
          {status === "loading" ? t("keys.loadingModels") : t("keys.loadModels")}
        </button>
      </div>
      <datalist id={listId}>
        {visible.map((m) => (
          <option key={m.id} value={m.id} />
        ))}
      </datalist>

      {status === "loaded" && (
        <p className="keys-hint">
          {visible.length > 0 ? t("keys.modelsFound", { n: visible.length }) : t("keys.noModels")}
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
      {status === "error" && (
        <p className="keys-hint">
          {t("keys.modelsError", {
            reason: t(REASON_KEY[reason ?? "unavailable"] ?? "compare.fail.unavailable"),
          })}
        </p>
      )}
    </div>
  );
}
