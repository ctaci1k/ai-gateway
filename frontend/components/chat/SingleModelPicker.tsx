// frontend/components/chat/SingleModelPicker.tsx
//
// New Single chat: choose which model answers (PH24, C3 / D). Cards for the 3
// built-in responders plus any active BYOK custom models and — per NQ6 — the
// judge model. The chosen model is FIXED for the chat at creation (owner
// decision 3); picking enters the draft (openSingle), and the first message
// persists the saved chat. "Add your own model" deep-links to Settings → keys.

"use client";

import { IconChevronRight, IconPlus, IconSparkle } from "@/components/icons/Icons";
import { SINGLE_PROVIDERS, useComposer } from "@/store/ComposerContext";
import { JUDGE_SLOT, useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";
import { useSettings } from "@/store/SettingsContext";
import { responderLabel } from "@/utils/models";

// A short, stable accent color per built-in slot (chip background only).
const SLOT_COLOR: Record<string, string> = {
  groq: "#f0663c",
  mistral: "#fa520f",
  scout: "#2563eb",
};

export default function SingleModelPicker() {
  const { t } = useI18n();
  const { openSingle } = useComposer();
  const { activeResponders, judgeActive, byokModelId } = useKeys();
  const { open: openSettings } = useSettings();

  const customSlots = activeResponders.filter((r) => r.custom).map((r) => r.slot);
  const slots = [...SINGLE_PROVIDERS, ...customSlots];
  if (judgeActive) slots.push(JUDGE_SLOT);

  function nameFor(slot: string): string {
    if (slot === JUDGE_SLOT) return byokModelId(JUDGE_SLOT) ?? t("keys.judge");
    return byokModelId(slot) ?? responderLabel(slot);
  }

  function descFor(slot: string): string {
    if (slot === JUDGE_SLOT) return t("picker.desc.judge");
    if (slot in SLOT_COLOR) return t(`picker.desc.${slot}`);
    return t("picker.desc.custom");
  }

  return (
    <div className="cc-pick">
      <div className="cc-pick-inner">
        <h2>{t("picker.title")}</h2>
        <p>{t("picker.subtitle")}</p>
        <div className="cc-pick-grid">
          {slots.map((slot) => (
            <button key={slot} type="button" className="cc-mcard" onClick={() => openSingle(slot)}>
              <div className="cc-mcard-top">
                <span
                  className="cc-mcard-ic"
                  style={{ background: SLOT_COLOR[slot] ?? "var(--accent)" }}
                  aria-hidden="true"
                >
                  <IconSparkle size={18} />
                </span>
                <div>
                  <b>{nameFor(slot)}</b>
                  {byokModelId(slot) !== null && (
                    <span className="cc-your-model cc-your-model--card">
                      {t("single.yourModel")}
                    </span>
                  )}
                </div>
              </div>
              <div className="desc">{descFor(slot)}</div>
              <span className="pickbtn">
                {t("picker.use", { name: nameFor(slot) })}
                <IconChevronRight size={13} />
              </span>
            </button>
          ))}

          <button
            type="button"
            className="cc-mcard cc-mcard--add"
            onClick={() => openSettings("keys")}
          >
            <div className="cc-mcard-top">
              <span className="cc-mcard-ic cc-mcard-ic--ghost" aria-hidden="true">
                <IconPlus size={18} />
              </span>
              <div>
                <b>{t("keys.addModel")}</b>
              </div>
            </div>
            <div className="desc">{t("picker.addDesc")}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
