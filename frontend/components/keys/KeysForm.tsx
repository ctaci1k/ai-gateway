// frontend/components/keys/KeysForm.tsx
//
// BYOK key editor body (PH17 logic, relocated into Settings in PH24/E3; base-URL
// UX reworked in PH29 / plan 027). Settings renders this; there is no separate
// modal, so the logic is NOT duplicated.
//
// Each row has three fields: a curated Base URL <select> (BaseUrlSelect), the
// API key (masked) and the model ID, each with an ⓘ InfoTip. The judge gets a
// base-URL select too (default = the built-in Groq endpoint) and a "Clear"
// button that resets it to the built-in judge; custom AI 4/5 rows keep "Remove".
//
// On Save each filled (base_url + key + model) is validated by a live test call;
// working keys activate, failing ones stay highlighted red with a per-key
// message. Keys live only in sessionStorage (NQ5) — never persisted/logged.

"use client";

import { useCallback, useState } from "react";

import InfoTip from "@/components/common/InfoTip";
import { IconCheck, IconPlus } from "@/components/icons/Icons";
import BaseUrlSelect from "@/components/keys/BaseUrlSelect";
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
  // Bumped on Clear to remount the judge BaseUrlSelect so its internal "custom
  // mode" resets — the cleared judge shows the built-in endpoint, not "Custom…".
  const [judgeNonce, setJudgeNonce] = useState(0);

  const updateJudge = useCallback((field: "apiKey" | "modelId" | "baseUrl", value: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, judge: { ...d.judge, [field]: value, active: false } }));
  }, []);

  const clearJudge = useCallback(() => {
    setSaved(false);
    setJudgeNonce((n) => n + 1);
    setResults((prev) => {
      const next = { ...prev };
      delete next[JUDGE_SLOT];
      return next;
    });
    setDraft((d) => ({
      ...d,
      judge: { baseUrl: "", apiKey: "", modelId: "", active: false },
    }));
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

  // Shared ⓘ tip for each field type (where to get it / what to enter / pairing).
  const apiKeyInfo = (
    <InfoTip
      label={t("keys.infoLabel", { field: t("keys.apiKey") })}
      text={t("keys.info.apiKey")}
    />
  );
  const modelIdInfo = (
    <InfoTip
      label={t("keys.infoLabel", { field: t("keys.modelId") })}
      text={t("keys.info.modelId")}
    />
  );
  const baseUrlInfo = (
    <InfoTip
      label={t("keys.infoLabel", { field: t("keys.baseUrlSelect") })}
      text={t("keys.info.baseUrl")}
    />
  );

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
            <div className="keys-head-right">
              <span className="keys-default">
                {t("keys.defaultName", { name: judgeModelName(JUDGE_MODEL) ?? "Qwen" })}
              </span>
              <button type="button" className="keys-clear" onClick={clearJudge}>
                {t("keys.clear")}
              </button>
            </div>
          </div>
          <div className="keys-fields">
            <BaseUrlSelect
              key={judgeNonce}
              id="keys-judge-baseurl"
              label={t("keys.baseUrlSelect")}
              value={draft.judge.baseUrl}
              defaultOptionLabel={t("keys.useDefaultEndpointJudge")}
              info={baseUrlInfo}
              onChange={(v) => updateJudge("baseUrl", v)}
            />
            <div className="keys-field">
              <span className="keys-field-label">
                <label htmlFor="keys-judge-key">{t("keys.apiKey")}</label>
                {apiKeyInfo}
              </span>
              <KeyInput
                id="keys-judge-key"
                value={draft.judge.apiKey}
                placeholder={t("keys.apiKey")}
                invalid={judgeResult ? !judgeResult.ok : false}
                showLabel={showLabel}
                hideLabel={hideLabel}
                onChange={(v) => updateJudge("apiKey", v)}
              />
            </div>
            <div className="keys-field">
              <span className="keys-field-label">
                <label htmlFor="keys-judge-model">{t("keys.modelId")}</label>
                {modelIdInfo}
              </span>
              <input
                id="keys-judge-model"
                className="keys-input keys-input--model"
                value={draft.judge.modelId}
                placeholder={t("keys.modelId")}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => updateJudge("modelId", e.target.value)}
              />
            </div>
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
                <BaseUrlSelect
                  id={`keys-${r.slot}-baseurl`}
                  label={t("keys.baseUrlSelect")}
                  value={r.baseUrl}
                  // Default slots may fall back to the provider's fixed endpoint;
                  // custom (added) rows must point at a concrete endpoint.
                  defaultOptionLabel={r.custom ? undefined : t("keys.useDefaultEndpoint")}
                  info={baseUrlInfo}
                  onChange={(v) => updateResponder(index, "baseUrl", v)}
                />
                <div className="keys-field">
                  <span className="keys-field-label">
                    <label htmlFor={`keys-${r.slot}-key`}>{t("keys.apiKey")}</label>
                    {apiKeyInfo}
                  </span>
                  <KeyInput
                    id={`keys-${r.slot}-key`}
                    value={r.apiKey}
                    placeholder={t("keys.apiKey")}
                    invalid={result ? !result.ok : false}
                    showLabel={showLabel}
                    hideLabel={hideLabel}
                    onChange={(v) => updateResponder(index, "apiKey", v)}
                  />
                </div>
                <div className="keys-field">
                  <span className="keys-field-label">
                    <label htmlFor={`keys-${r.slot}-model`}>{t("keys.modelId")}</label>
                    {modelIdInfo}
                  </span>
                  <input
                    id={`keys-${r.slot}-model`}
                    className="keys-input keys-input--model"
                    value={r.modelId}
                    placeholder={t("keys.modelId")}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => updateResponder(index, "modelId", e.target.value)}
                  />
                </div>
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
