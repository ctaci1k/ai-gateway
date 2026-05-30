// frontend/components/chat/TopbarModeContext.tsx
//
// Mode-dependent context shown in the topbar (PH14/3):
//   Single  → responder picker + the "not saved separately" note.
//   Compare → a short explanation of how the mode works (judge model from D-9).
// One shared slot so neither page duplicates this chrome.

"use client";

import ModelSwitcher from "@/components/chat/ModelSwitcher";
import { useChatMode } from "@/store/ChatModeContext";
import { useI18n } from "@/store/LanguageContext";
import { JUDGE_MODEL, judgeModelName } from "@/utils/judge";

export default function TopbarModeContext() {
  const { mode } = useChatMode();
  const { t } = useI18n();

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
      <p className="topbar-ctx-note">
        {t("topbar.compareInfo", { model: judgeModelName(JUDGE_MODEL) ?? "" })}
      </p>
    </div>
  );
}
