// frontend/components/keys/KeysForm.tsx
//
// BYOK key editor body (PH17 logic, relocated into Settings in PH24/E3). This is
// the exact judge + responder form extracted from the old KeysModal so the
// logic is NOT duplicated — Settings renders this; there is no separate modal.
//
// On Save each filled (base_url + key + model) is validated by a live test call;
// working keys activate, failing ones stay highlighted red with a per-key
// message. Keys live only in sessionStorage (NQ5) — never persisted/logged.

"use client";

import { useCallback, useState } from "react";

import { IconCheck, IconPlus } from "@/components/icons/Icons";
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

export default function KeysForm() {
  const { t } = useI18n();
  const { state, saveAndValidate } = useKeys();

  const [draft, setDraft] = useState<KeysState>(() => cloneState(state));
  const [results, setResults] = useState<Record<string, ValidateResult>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateJudge = useCallback((field: "apiKey" | "modelId", value: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, judge: { ...d.judge, [field]: value, active: false } }));
  }, []);

  const updateResponder = useCallback(
    (index: number, field: "apiKey" | "modelId" | "baseUrl", value: string) => {
      setSaved(false);
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
    setSaved(false);
    try {
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
      setSaved(!anyFailed);
    } finally {
      setSaving(false);
    }
  }, [draft, saveAndValidate]);

  const showLabel = t("keys.show");
  const hideLabel = t("keys.hide");
  const judgeResult = results[JUDGE_SLOT];

  const defaultSlots = draft.responders.filter((r) => !r.custom).map((r) => r.slot);
  const customSlots = draft.responders.filter((r) => r.custom).map((r) => r.slot);

  return (
    <div className="keys-form">
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

      <div className="keys-form-actions">
        {saved && (
          <span className="keys-saved" role="status">
            <IconCheck size={14} /> {t("keys.saved")}
          </span>
        )}
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
  );
}
