// frontend/components/chat/TopbarModeContext.tsx
//
// Mode-dependent context shown in the topbar (PH14/3):
//   Single  → responder picker + the "not saved separately" note.
//   Compare → a short explanation of how the mode works (judge model from D-9).
// One shared slot so neither page duplicates this chrome.

"use client";

import ModelSwitcher from "@/components/chat/ModelSwitcher";
import { useChatMode } from "@/store/ChatModeContext";
import { JUDGE_SLOT, useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";
import { JUDGE_MODEL, judgeModelName } from "@/utils/judge";

export default function TopbarModeContext() {
  const { mode } = useChatMode();
  const { t } = useI18n();
  const { byokModelId } = useKeys();

  // Truthful judge name (PH23/A2): when a BYOK judge is active, the topbar shows
  // the user's entered judge model_id; otherwise the built-in default (Qwen).
  const judgeLabel = byokModelId(JUDGE_SLOT) ?? judgeModelName(JUDGE_MODEL) ?? "";

  if (mode === "single") {
    return (
      <div className="topbar-ctx">
        <ModelSwitcher />
        <p className="topbar-ctx-note">
          <span className="single-note-star">*</span> {t("single.note")}
        </p>
      </div>
    );
  }

  return (
    <div className="topbar-ctx">
      <p className="topbar-ctx-note">{t("topbar.compareInfo", { model: judgeLabel })}</p>
    </div>
  );
}
