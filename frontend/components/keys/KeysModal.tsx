// frontend/components/keys/KeysModal.tsx
//
// BYOK settings dialog (PH17, D-12). Lets any account supply its own API keys
// for the judge + up to 5 responders. Accessible (role="dialog", aria-modal,
// Esc/backdrop to close, focus moved in on open). Keys are masked by default
// with a per-field show/hide toggle, and always start hidden on open (NQ5):
// the dialog body mounts fresh on each open, so draft + toggles reset.
//
// On Save each filled (base_url + key + model) is validated by a live test call;
// working keys activate, failing ones stay in the form highlighted red with a
// per-key message (a single-character typo shouldn't wipe the field).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IconClose, IconPlus } from "@/components/icons/Icons";
import type { ValidateResult } from "@/services/keysApi";
import { useI18n } from "@/store/LanguageContext";
import { JUDGE_SLOT, MAX_RESPONDERS, useKeys, type KeysState } from "@/store/KeysContext";
import { JUDGE_MODEL, judgeModelName } from "@/utils/judge";
import { responderLabel } from "@/utils/models";

function cloneState(state: KeysState): KeysState {
  return {
    judge: { ...state.judge },
    responders: state.responders.map((r) => ({ ...r })),
  };
}

interface KeyInputProps {
  id: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  showLabel: string;
  hideLabel: string;
  onChange: (value: string) => void;
}

function KeyInput({
  id,
  value,
  placeholder,
  invalid,
  showLabel,
  hideLabel,
  onChange,
}: KeyInputProps) {
  // Fresh mount per dialog open → starts hidden every time (NQ5).
  const [shown, setShown] = useState(false);
  return (
    <div className="keys-input-wrap">
      <input
        id={id}
        type={shown ? "text" : "password"}
        className={invalid ? "keys-input keys-input--invalid" : "keys-input"}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="keys-eye"
        aria-pressed={shown}
        aria-label={shown ? hideLabel : showLabel}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? hideLabel : showLabel}
      </button>
    </div>
  );
}

// The dialog body — mounted only while open so its draft state initializes
// fresh from the store on every open (no reset effect needed).
function KeysDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { state, saveAndValidate } = useKeys();

  const [draft, setDraft] = useState<KeysState>(() => cloneState(state));
  const [results, setResults] = useState<Record<string, ValidateResult>>({});
  const [saving, setSaving] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused.current?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  const updateJudge = useCallback((field: "apiKey" | "modelId", value: string) => {
    setDraft((d) => ({ ...d, judge: { ...d.judge, [field]: value, active: false } }));
  }, []);

  const updateResponder = useCallback(
    (index: number, field: "apiKey" | "modelId" | "baseUrl", value: string) => {
      setDraft((d) => ({
        ...d,
        responders: d.responders.map((r, i) =>
          i === index ? { ...r, [field]: value, active: false } : r,
        ),
      }));
    },
    [],
  );

  const addResponder = useCallback(() => {
    setDraft((d) => {
      if (d.responders.length >= MAX_RESPONDERS) return d;
      const slot = `custom-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...d,
        responders: [
          ...d.responders,
          { slot, baseUrl: "", apiKey: "", modelId: "", custom: true, active: false },
        ],
      };
    });
  }, []);

  const removeResponder = useCallback((index: number) => {
    setDraft((d) => ({ ...d, responders: d.responders.filter((_, i) => i !== index) }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      // Drop fully-empty added (custom) rows before validating (D-15): pressing
      // Save on a blank "Added model" removes it instead of persisting clutter.
      // Invalid (filled but failing) custom rows stay below, highlighted red, so
      // a typo can be fixed; they are not persisted by saveAndValidate.
      const pruned: KeysState = {
        ...draft,
        responders: draft.responders.filter(
          (r) => !(r.custom && !r.apiKey.trim() && !r.modelId.trim() && !r.baseUrl.trim()),
        ),
      };
      setDraft(pruned);
      const bySlot = await saveAndValidate(pruned);
      setResults(bySlot);
      const anyFailed = Object.values(bySlot).some((r) => !r.ok);
      if (!anyFailed) onClose();
    } finally {
      setSaving(false);
    }
  }, [draft, saveAndValidate, onClose]);

  const showLabel = t("keys.show");
  const hideLabel = t("keys.hide");
  const judgeResult = results[JUDGE_SLOT];

  // Default responder slots are labeled generically ("AI 1/2/3") with the real
  // model shown as a "default: …" hint — only here in the BYOK dialog (D-14);
  // truthful names stay everywhere else. Custom (added) rows continue the
  // numbering as "Added model — AI 4/5" (D-15). Numbering follows slot order.
  const defaultSlots = draft.responders.filter((r) => !r.custom).map((r) => r.slot);
  const customSlots = draft.responders.filter((r) => r.custom).map((r) => r.slot);

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog keys-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keys-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="keys-head">
          <h2 id="keys-title" className="dialog-title">
            {t("keys.title")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="keys-close"
            aria-label={t("common.cancel")}
            onClick={onClose}
          >
            <IconClose size={16} />
          </button>
        </div>

        <p className="keys-intro">{t("keys.intro")}</p>
        <ul className="keys-notes">
          <li>{t("keys.noteSecurity")}</li>
          <li>{t("keys.noteFree")}</li>
          <li>{t("keys.notePartial")}</li>
          <li>{t("keys.noteJudgeSingle")}</li>
        </ul>

        <div className="keys-rows">
          {/* Judge row */}
          <div className="keys-row">
            <div className="keys-row-head">
              <span className="keys-slot">{t("keys.judge")}</span>
              <span className="keys-default">
                {t("keys.defaultName", { name: judgeModelName(JUDGE_MODEL) ?? "Qwen" })}
              </span>
            </div>
            <div className="keys-fields">
              <KeyInput
                id="keys-judge-key"
                value={draft.judge.apiKey}
                placeholder={t("keys.apiKey")}
                invalid={judgeResult ? !judgeResult.ok : false}
                showLabel={showLabel}
                hideLabel={hideLabel}
                onChange={(v) => updateJudge("apiKey", v)}
              />
              <input
                className="keys-input keys-input--model"
                value={draft.judge.modelId}
                placeholder={t("keys.modelId")}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => updateJudge("modelId", e.target.value)}
              />
            </div>
            {judgeResult && !judgeResult.ok && <p className="keys-error">{t("keys.keyFailed")}</p>}
          </div>

          {/* Responder rows */}
          {draft.responders.map((r, index) => {
            const result = results[r.slot];
            const slotLabel = r.custom
              ? t("keys.customResponderNumbered", {
                  n: defaultSlots.length + customSlots.indexOf(r.slot) + 1,
                })
              : t("keys.responderSlot", { n: defaultSlots.indexOf(r.slot) + 1 });
            return (
              <div className="keys-row" key={r.slot}>
                <div className="keys-row-head">
                  <span className="keys-slot">{slotLabel}</span>
                  {r.custom ? (
                    <button
                      type="button"
                      className="keys-remove"
                      onClick={() => removeResponder(index)}
                    >
                      {t("keys.remove")}
                    </button>
                  ) : (
                    <span className="keys-default">
                      {t("keys.defaultName", { name: responderLabel(r.slot) })}
                    </span>
                  )}
                </div>
                <div className="keys-fields">
                  {/* Base URL is optional for the built-in slots (leave empty →
                      provider's own endpoint) and required for custom ones, so a
                      default slot can be pointed at another provider (PH22). */}
                  <input
                    className="keys-input keys-input--url"
                    value={r.baseUrl}
                    placeholder={r.custom ? t("keys.baseUrl") : t("keys.baseUrlOptional")}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => updateResponder(index, "baseUrl", e.target.value)}
                  />
                  <KeyInput
                    id={`keys-${r.slot}`}
                    value={r.apiKey}
                    placeholder={t("keys.apiKey")}
                    invalid={result ? !result.ok : false}
                    showLabel={showLabel}
                    hideLabel={hideLabel}
                    onChange={(v) => updateResponder(index, "apiKey", v)}
                  />
                  <input
                    className="keys-input keys-input--model"
                    value={r.modelId}
                    placeholder={t("keys.modelId")}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => updateResponder(index, "modelId", e.target.value)}
                  />
                </div>
                {result && !result.ok && <p className="keys-error">{t("keys.keyFailed")}</p>}
              </div>
            );
          })}

          {draft.responders.length < MAX_RESPONDERS && (
            <button type="button" className="keys-add" onClick={addResponder}>
              <IconPlus size={14} />
              {t("keys.addResponder")}
            </button>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="dialog-btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="dialog-btn dialog-btn--primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? t("keys.saving") : t("keys.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KeysModal() {
  const { isOpen, close } = useKeys();
  if (!isOpen) return null;
  return <KeysDialog onClose={close} />;
}
