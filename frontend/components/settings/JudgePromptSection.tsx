// frontend/components/settings/JudgePromptSection.tsx
//
// Settings → Judge prompt (PH24, E2). Lets the user edit the system prompt the
// AI judge runs under (the one "under the hood"), reset it to the built-in
// default, and view the default for reference. The override persists per-user
// (backend Preference.data) and the backend applies it when judging Compare.
//
// The required $placeholders ($user_message, $responses_block,
// $allowed_models_inline, $scores_example) must be kept — the backend rejects an
// override that drops them, surfaced here as an inline error.

"use client";

import { useEffect, useState } from "react";

import { getJudgePrompt, putJudgePrompt } from "@/services/preferencesApi";
import { useI18n } from "@/store/LanguageContext";

export default function JudgePromptSection() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [usingDefault, setUsingDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDefault, setShowDefault] = useState(false);

  useEffect(() => {
    let active = true;
    getJudgePrompt()
      .then((data) => {
        if (!active) return;
        setDefaultPrompt(data.default);
        setUsingDefault(data.override === null);
        setText(data.override ?? data.default);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t("errors.generic"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const data = await putJudgePrompt(text);
      setUsingDefault(data.override === null);
      setText(data.override ?? data.default);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const data = await putJudgePrompt(null);
      setDefaultPrompt(data.default);
      setUsingDefault(true);
      setText(data.default);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="settings-loading">{t("common.loading")}</div>;
  }

  return (
    <div className="settings-section-body">
      <h3 className="settings-h">{t("settings.judge.title")}</h3>
      <p className="settings-desc">{t("settings.judge.desc")}</p>
      <p className="settings-hint">
        {usingDefault ? t("settings.judge.usingDefault") : t("settings.judge.usingCustom")}
      </p>

      <label className="settings-label" htmlFor="judge-prompt-ta">
        {t("settings.judge.editorLabel")}
      </label>
      <textarea
        id="judge-prompt-ta"
        className="settings-textarea thin-scroll"
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={14}
      />
      <p className="settings-hint">{t("settings.judge.placeholdersHint")}</p>

      {error && <p className="settings-error">{error}</p>}

      <div className="settings-actions">
        {saved && <span className="settings-saved">{t("settings.saved")}</span>}
        <button
          type="button"
          className="dialog-btn"
          onClick={() => void reset()}
          disabled={saving || usingDefault}
        >
          {t("settings.judge.reset")}
        </button>
        <button
          type="button"
          className="dialog-btn dialog-btn--primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? t("settings.saving") : t("settings.save")}
        </button>
      </div>

      <button
        type="button"
        className="settings-disclosure"
        onClick={() => setShowDefault((s) => !s)}
        aria-expanded={showDefault}
      >
        {showDefault ? t("settings.judge.hideDefault") : t("settings.judge.showDefault")}
      </button>
      {showDefault && (
        <pre className="settings-default thin-scroll" aria-label={t("settings.judge.defaultLabel")}>
          {defaultPrompt}
        </pre>
      )}
    </div>
  );
}
