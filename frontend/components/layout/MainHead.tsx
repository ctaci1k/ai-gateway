// frontend/components/layout/MainHead.tsx
//
// The main-area header (PH24): a model chip for Single, a mode tag for Compare.
//
// Single model rules (owner decision 3): the model is FIXED at creation. In an
// existing Single chat the chip is read-only — clicking it shows a hint that the
// model can only be changed in a new chat (no dialog, no thread clearing). In a
// draft (no saved chat yet) clicking the chip reopens the model picker.

"use client";

import { useState } from "react";

import { IconChevron } from "@/components/icons/Icons";
import { useChatMode } from "@/store/ChatModeContext";
import { useChats } from "@/store/ChatsContext";
import { useComposer } from "@/store/ComposerContext";
import { JUDGE_SLOT, useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";
import { responderLabel } from "@/utils/models";

export default function MainHead() {
  const { t } = useI18n();
  const { mode } = useChatMode();
  const { activeChatId, activeChat } = useChats();
  const { singleProvider, openSingle } = useComposer();
  const { byokModelId } = useKeys();
  const [hint, setHint] = useState(false);

  function labelFor(slot: string): string {
    if (slot === JUDGE_SLOT) return byokModelId(JUDGE_SLOT) ?? t("keys.judge");
    return byokModelId(slot) ?? responderLabel(slot);
  }

  if (mode === "compare") {
    return (
      <div className="cc-main-head">
        <span className="cc-mode-tag">{t("compare.modeTag")}</span>
      </div>
    );
  }

  // Single mode.
  const inSavedChat = activeChatId !== null && activeChat?.mode === "single";
  const model = inSavedChat ? activeChat?.model : singleProvider;
  // "Your model" badge only when the chip's model runs on the user's OWN key
  // (built-in app keys → no badge). byokModelId is non-null only for a stored
  // own key and covers responder + judge slots. This is an active-model surface
  // → intentionally reads current keys (D-22), not the saved turn.
  const ownKey = model != null && byokModelId(model) !== null;

  if (!model) {
    // Picker state (a new Single chat, no model chosen yet).
    return (
      <div className="cc-main-head">
        <span className="cc-mode-tag">{t("single.newTag")}</span>
      </div>
    );
  }

  return (
    <div className="cc-main-head">
      <div className="cc-modelchip-wrap">
        <button
          type="button"
          className="cc-modelchip"
          onClick={() => {
            if (inSavedChat) {
              setHint((h) => !h);
            } else {
              openSingle(null); // draft → reopen picker (still pre-creation)
            }
          }}
          aria-label={t("single.model")}
        >
          <span className="mdot" aria-hidden="true" />
          {labelFor(model)}
          <span className="sw" aria-hidden="true">
            <IconChevron size={14} />
          </span>
        </button>
        {ownKey && <span className="cc-your-model">{t("single.yourModel")}</span>}
        {hint && inSavedChat && (
          <div className="cc-modelchip-hint" role="status">
            {t("single.modelLocked")}
          </div>
        )}
      </div>
    </div>
  );
}
