// frontend/components/keys/KeysForm.tsx
//
// BYOK key editor (PH17 logic; base-URL UX from PH29.x; WRITE-ONLY server-side
// storage from PH30 / D-20).
//
// Keys are stored server-side, ENCRYPTED, per-account. The form is therefore
// WRITE-ONLY: model_id / base_url are prefilled from metadata, and the key field
// is empty with a "••••last4 — enter to replace" placeholder for a stored slot.
// Saving sends only changed rows (a stored key is reused when only model/base_url
// change). "Clear" (built-in) / "Remove" (custom) delete the slot server-side.
//
// Every row keeps the PH29.x affordances: a base-URL <select> (BaseUrlSelect)
// over the curated catalogue, an ⓘ InfoTip per field, and the PH29.2 block on
// partially-filled rows (Save flags them red and persists nothing).

"use client";

import { useCallback, useState } from "react";

import InfoTip from "@/components/common/InfoTip";
import { IconCheck, IconPlus } from "@/components/icons/Icons";
import BaseUrlSelect from "@/components/keys/BaseUrlSelect";
import ModelCombobox from "@/components/keys/ModelCombobox";
import ProviderGuide from "@/components/keys/ProviderGuide";
import type { SaveEntry, SaveResult } from "@/services/keysApi";
import { useI18n } from "@/store/LanguageContext";
import {
  JUDGE_SLOT,
  MAX_RESPONDERS,
  findIncompleteSlots,
  isBuiltinIncomplete,
  isCustomIncomplete,
  useKeys,
  type DraftState,
  type KeysState,
} from "@/store/KeysContext";
import {
  builtinForSlot,
  providerLinksForSlot,
  providerLinksForUrl,
  selectableEndpointsForSlot,
} from "@/utils/byokEndpoints";
import { JUDGE_MODEL, judgeModelName } from "@/utils/judge";
import { responderLabel } from "@/utils/models";

// Seed an editable draft from the server-metadata state (key fields start empty).
function draftFromState(state: KeysState): DraftState {
  return {
    judge: { ...state.judge, apiKey: "" },
    responders: state.responders.map((r) => ({ ...r, apiKey: "" })),
  };
}

// Build the SaveEntry for a row, or null when there's nothing to persist:
// nothing typed and either empty or already-stored-and-unchanged. Incomplete
// rows are blocked before this runs, so a returned entry is always complete.
function entryForRow(
  row: { slot: string; baseUrl: string; apiKey: string; modelId: string; stored: boolean },
  original: { baseUrl: string; modelId: string } | undefined,
  custom: boolean,
): SaveEntry | null {
  const apiKey = row.apiKey.trim();
  const modelId = row.modelId.trim();
  const baseUrl = row.baseUrl.trim();
  const hasNewKey = apiKey !== "";
  const changed = modelId !== (original?.modelId ?? "") || baseUrl !== (original?.baseUrl ?? "");
  if (!hasNewKey && !row.stored) return null; // empty, nothing to store
  if (!hasNewKey && row.stored && !changed) return null; // unchanged stored slot
  return {
    slot: row.slot,
    model_id: modelId,
    base_url: baseUrl || undefined,
    ...(hasNewKey ? { api_key: apiKey } : {}),
    custom,
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
  const { state, saveKeys, removeKey } = useKeys();

  const [draft, setDraft] = useState<DraftState>(() => draftFromState(state));
  const [results, setResults] = useState<Record<string, SaveResult>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // True after a Save attempt blocked by incomplete rows: escalates the soft hint
  // to a red error and flags the empty key/model inputs. Reset on edit.
  const [submittedIncomplete, setSubmittedIncomplete] = useState(false);

  // Re-seed the draft whenever the server metadata changes (hydration / save /
  // delete) using the "adjust state during render" pattern (no effect): typing
  // doesn't change `state`, so in-progress edits are preserved; a save clears the
  // key fields and reflects the new last4.
  const [seededFrom, setSeededFrom] = useState(state);
  if (seededFrom !== state) {
    setSeededFrom(state);
    setDraft(draftFromState(state));
    setResults({});
    setSubmittedIncomplete(false);
  }

  const dropResult = useCallback((slot: string) => {
    setResults((prev) => {
      if (!(slot in prev)) return prev;
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }, []);

  const updateJudge = useCallback((field: "apiKey" | "modelId" | "baseUrl", value: string) => {
    setSaved(false);
    setSubmittedIncomplete(false);
    setDraft((d) => ({ ...d, judge: { ...d.judge, [field]: value } }));
  }, []);

  const clearJudge = useCallback(() => {
    setSaved(false);
    dropResult(JUDGE_SLOT);
    if (draft.judge.stored) {
      void removeKey(JUDGE_SLOT); // reseed effect clears the row after delete
    } else {
      setDraft((d) => ({
        ...d,
        judge: { baseUrl: "", apiKey: "", modelId: "", last4: "", stored: false },
      }));
    }
  }, [draft.judge.stored, dropResult, removeKey]);

  const updateResponder = useCallback(
    (index: number, field: "apiKey" | "modelId" | "baseUrl", value: string) => {
      setSaved(false);
      setSubmittedIncomplete(false);
      setDraft((d) => ({
        ...d,
        responders: d.responders.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
      }));
    },
    [],
  );

  // Built-in default slot: reset it back to the built-in (delete if stored).
  const clearResponder = useCallback(
    (index: number) => {
      setSaved(false);
      const target = draft.responders[index];
      if (!target) return;
      dropResult(target.slot);
      if (target.stored) {
        void removeKey(target.slot);
      } else {
        setDraft((d) => ({
          ...d,
          responders: d.responders.map((r, i) =>
            i === index
              ? { ...r, baseUrl: "", apiKey: "", modelId: "", last4: "", stored: false }
              : r,
          ),
        }));
      }
    },
    [draft.responders, dropResult, removeKey],
  );

  const addResponder = useCallback(() => {
    setDraft((d) => {
      if (d.responders.length >= MAX_RESPONDERS) return d;
      const slot = `custom-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...d,
        responders: [
          ...d.responders,
          { slot, baseUrl: "", apiKey: "", modelId: "", last4: "", custom: true, stored: false },
        ],
      };
    });
  }, []);

  const removeResponder = useCallback(
    (index: number) => {
      const target = draft.responders[index];
      if (target?.stored) {
        void removeKey(target.slot); // reseed effect drops it after delete
      } else {
        setDraft((d) => ({ ...d, responders: d.responders.filter((_, i) => i !== index) }));
      }
    },
    [draft.responders, removeKey],
  );

  const save = useCallback(async () => {
    // Reject the save outright if any row is partially filled (PH29.2): don't
    // validate, don't persist, don't report "Saved" — flag the rows instead.
    if (findIncompleteSlots(draft).length > 0) {
      setSubmittedIncomplete(true);
      setSaved(false);
      return;
    }
    setSubmittedIncomplete(false);

    // Collect only the rows that actually need persisting.
    const entries: SaveEntry[] = [];
    const judgeEntry = entryForRow({ ...draft.judge, slot: JUDGE_SLOT }, state.judge, false);
    if (judgeEntry) entries.push(judgeEntry);
    for (const r of draft.responders) {
      const original = state.responders.find((s) => s.slot === r.slot);
      const entry = entryForRow(r, original, r.custom);
      if (entry) entries.push(entry);
    }

    if (entries.length === 0) {
      setSaved(true); // nothing changed — already in sync with the server
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      const resultList = await saveKeys(entries);
      const bySlot: Record<string, SaveResult> = {};
      for (const r of resultList) bySlot[r.slot] = r;
      setResults(bySlot);
      setSaved(resultList.every((r) => r.ok));
    } finally {
      setSaving(false);
    }
  }, [draft, state, saveKeys]);

  const showLabel = t("keys.show");
  const hideLabel = t("keys.hide");
  const judgeResult = results[JUDGE_SLOT];
  const judgeIncomplete = isBuiltinIncomplete(
    draft.judge.baseUrl,
    draft.judge.apiKey,
    draft.judge.modelId,
    draft.judge.stored,
  );
  const judgeErr = submittedIncomplete && judgeIncomplete;

  const defaultSlots = draft.responders.filter((r) => !r.custom).map((r) => r.slot);
  const customSlots = draft.responders.filter((r) => r.custom).map((r) => r.slot);

  // Placeholder for a key field: a stored slot shows the masked "replace" hint.
  const keyPlaceholder = (last4: string, stored: boolean) =>
    stored && last4 ? t("keys.replaceMask", { last4 }) : t("keys.apiKey");

  // Per-row ⓘ tip for the API key, with a contextual "Get API key ↗" link for
  // the row's provider (built-in → by slot; custom → by chosen base URL, PH30/E3).
  const apiKeyInfo = (slot: string, baseUrl: string, custom: boolean) => {
    const links = custom ? providerLinksForUrl(baseUrl) : providerLinksForSlot(slot);
    return (
      <InfoTip
        label={t("keys.infoLabel", { field: t("keys.apiKey") })}
        text={t("keys.info.apiKey")}
        links={
          links && links.needsKey ? (
            <a
              className="keys-info-link"
              href={links.keysUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("keys.getKey")} ↗
            </a>
          ) : undefined
        }
      />
    );
  };
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
      <div className="keys-intro-row">
        <p className="keys-intro">{t("keys.intro")}</p>
        <ProviderGuide />
      </div>
      <ul className="keys-notes">
        <li>{t("keys.noteSecurity")}</li>
        <li>{t("keys.noteFree")}</li>
        <li>{t("keys.notePartial")}</li>
        <li>{t("keys.noteJudgeSingle")}</li>
      </ul>

      <div className="keys-rows">
        {/* Judge row (built-in: optional base-URL override, Clear → built-in) */}
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
              id="keys-judge-baseurl"
              label={t("keys.baseUrlSelect")}
              value={draft.judge.baseUrl}
              options={selectableEndpointsForSlot(JUDGE_SLOT, false)}
              placeholder={t("keys.endpointNamed", {
                provider: builtinForSlot(JUDGE_SLOT)?.label ?? "Groq",
              })}
              info={baseUrlInfo}
              onChange={(v) => updateJudge("baseUrl", v)}
            />
            <div className="keys-field">
              <span className="keys-field-label">
                <label htmlFor="keys-judge-key">{t("keys.apiKey")}</label>
                {apiKeyInfo(JUDGE_SLOT, draft.judge.baseUrl, false)}
              </span>
              <KeyInput
                id="keys-judge-key"
                value={draft.judge.apiKey}
                placeholder={keyPlaceholder(draft.judge.last4, draft.judge.stored)}
                invalid={
                  (judgeResult ? !judgeResult.ok : false) ||
                  (judgeErr && !draft.judge.apiKey.trim() && !draft.judge.stored)
                }
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
              <ModelCombobox
                id="keys-judge-model"
                value={draft.judge.modelId}
                onChange={(v) => updateJudge("modelId", v)}
                invalid={judgeErr && !draft.judge.modelId.trim()}
                placeholder={t("keys.modelId")}
                slot={JUDGE_SLOT}
                baseUrl={draft.judge.baseUrl}
                apiKey={draft.judge.apiKey}
                stored={draft.judge.stored}
              />
            </div>
          </div>
          {judgeIncomplete && (
            <p className={judgeErr ? "keys-error" : "keys-hint"}>{t("keys.incompleteBuiltin")}</p>
          )}
          {judgeResult && !judgeResult.ok && <p className="keys-error">{t("keys.keyFailed")}</p>}
        </div>

        {/* Responder rows */}
        {draft.responders.map((r, index) => {
          const result = results[r.slot];
          // Built-in slots are named by their provider (AI 1 · Groq) so the user
          // can tell which key goes where; custom slots keep the AI n numbering.
          const builtin = builtinForSlot(r.slot);
          const slotLabel = r.custom
            ? t("keys.customResponderNumbered", {
                n: defaultSlots.length + customSlots.indexOf(r.slot) + 1,
              })
            : t("keys.responderSlotNamed", {
                n: defaultSlots.indexOf(r.slot) + 1,
                provider: builtin?.label ?? r.slot,
              });
          const incomplete = r.custom
            ? isCustomIncomplete(r.baseUrl, r.apiKey, r.modelId, r.stored)
            : isBuiltinIncomplete(r.baseUrl, r.apiKey, r.modelId, r.stored);
          const rowErr = submittedIncomplete && incomplete;
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
                  <div className="keys-head-right">
                    <span className="keys-default">
                      {t("keys.defaultName", { name: responderLabel(r.slot) })}
                    </span>
                    <button
                      type="button"
                      className="keys-clear"
                      onClick={() => clearResponder(index)}
                    >
                      {t("keys.clear")}
                    </button>
                  </div>
                )}
              </div>
              <div className="keys-fields">
                <BaseUrlSelect
                  id={`keys-${r.slot}-baseurl`}
                  label={t("keys.baseUrlSelect")}
                  value={r.baseUrl}
                  options={selectableEndpointsForSlot(r.slot, r.custom)}
                  // Built-in slots: empty = the slot's own provider (named
                  // default); the other built-ins + compatibles are overrides.
                  // Custom slots: an endpoint must be chosen.
                  placeholder={
                    r.custom
                      ? t("keys.baseUrlChoose")
                      : t("keys.endpointNamed", { provider: builtin?.label ?? r.slot })
                  }
                  info={baseUrlInfo}
                  onChange={(v) => updateResponder(index, "baseUrl", v)}
                />
                <div className="keys-field">
                  <span className="keys-field-label">
                    <label htmlFor={`keys-${r.slot}-key`}>{t("keys.apiKey")}</label>
                    {apiKeyInfo(r.slot, r.baseUrl, r.custom)}
                  </span>
                  <KeyInput
                    id={`keys-${r.slot}-key`}
                    value={r.apiKey}
                    placeholder={keyPlaceholder(r.last4, r.stored)}
                    invalid={
                      (result ? !result.ok : false) || (rowErr && !r.apiKey.trim() && !r.stored)
                    }
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
                  <ModelCombobox
                    id={`keys-${r.slot}-model`}
                    value={r.modelId}
                    onChange={(v) => updateResponder(index, "modelId", v)}
                    invalid={rowErr && !r.modelId.trim()}
                    placeholder={t("keys.modelId")}
                    slot={r.slot}
                    baseUrl={r.baseUrl}
                    apiKey={r.apiKey}
                    stored={r.stored}
                  />
                </div>
              </div>
              {incomplete && (
                <p className={rowErr ? "keys-error" : "keys-hint"}>
                  {r.custom ? t("keys.incompleteCustom") : t("keys.incompleteBuiltin")}
                </p>
              )}
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
