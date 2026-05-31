// frontend/components/chat/ModelSwitcher.tsx
//
// Single-mode responder picker (PH13/B1): choose which model streams the answer.
// Built-in models (groq / cerebras / sambanova) are always offered; BYOK adds
// the user's active custom models and — per NQ6 — the judge model too, plus a
// "+" chip that opens the BYOK settings. Selection is held in ComposerContext.
//
// PH16/A1: switching models on a non-empty thread first asks for confirmation —
// the visible conversation is cleared and cannot be restored — then switches.
// On an empty thread it switches immediately, no dialog.

"use client";

import { useState } from "react";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import { IconPlus } from "@/components/icons/Icons";
import { SINGLE_PROVIDERS, useComposer, type SingleProvider } from "@/store/ComposerContext";
import { JUDGE_SLOT, useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";
import { responderLabel } from "@/utils/models";

export default function ModelSwitcher() {
  const { t } = useI18n();
  const { singleProvider, setSingleProvider, hasSingleThread, clear } = useComposer();
  const { activeResponders, judgeActive, byokModelId, open } = useKeys();
  const [pending, setPending] = useState<SingleProvider | null>(null);

  // Built-ins + active custom BYOK models + the judge model (NQ6). De-duped:
  // a built-in slot overridden by a BYOK key is still its single chip.
  const customSlots = activeResponders.filter((r) => r.custom).map((r) => r.slot);
  const slots = [...SINGLE_PROVIDERS, ...customSlots];
  if (judgeActive) slots.push(JUDGE_SLOT);

  function labelFor(slot: string): string {
    if (slot === JUDGE_SLOT) return byokModelId(JUDGE_SLOT) ?? "Judge";
    // A BYOK-overridden / custom slot shows the exact model_id (NQ4).
    return byokModelId(slot) ?? responderLabel(slot);
  }

  function requestSwitch(provider: SingleProvider) {
    if (provider === singleProvider) return;
    if (hasSingleThread) {
      setPending(provider); // non-empty thread → confirm first (A1)
    } else {
      setSingleProvider(provider);
    }
  }

  function confirmSwitch() {
    if (pending) {
      clear();
      setSingleProvider(pending);
    }
    setPending(null);
  }

  return (
    <div className="model-switch" role="group" aria-label={t("single.model")}>
      <span className="model-switch-cap">{t("single.model")}</span>
      {slots.map((slot) => {
        const active = slot === singleProvider;
        return (
          <button
            key={slot}
            type="button"
            className={active ? "model-chip model-chip--active" : "model-chip"}
            aria-pressed={active}
            onClick={() => requestSwitch(slot)}
          >
            {labelFor(slot)}
          </button>
        );
      })}

      <button
        type="button"
        className="model-chip model-chip--add"
        aria-label={t("keys.addModel")}
        title={t("keys.addModel")}
        onClick={open}
      >
        <IconPlus size={13} />
      </button>

      <ConfirmDialog
        open={pending !== null}
        title={t("single.switchTitle")}
        message={t("single.switchConfirm")}
        confirmLabel={t("single.switchConfirmYes")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmSwitch}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
