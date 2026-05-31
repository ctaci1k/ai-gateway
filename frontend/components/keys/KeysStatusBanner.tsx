// frontend/components/keys/KeysStatusBanner.tsx
//
// BYOK status plashka shown above the limit banner (PH17, step 7):
//   - Single: a green "connected — no limits" plashka when the selected model
//     runs on the user's own key (the judge model is selectable here too, NQ6).
//   - Compare: green when every participant (responders + judge) is on own keys
//     (unlimited), red "available with limits" when some — but not all — are.
// Nothing shows when the user has no active own keys (the limit banner covers
// the default, app-key case).

"use client";

import { IconCheck, IconInfo } from "@/components/icons/Icons";
import { useChatMode } from "@/store/ChatModeContext";
import { useComposer } from "@/store/ComposerContext";
import { DEFAULT_RESPONDER_SLOTS, JUDGE_SLOT, useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";

export default function KeysStatusBanner() {
  const { mode } = useChatMode();
  const { t } = useI18n();
  const { singleProvider } = useComposer();
  const { isOwnKey, judgeActive, byokModelId, byokPayload, activeResponders, allParticipantsOwn } =
    useKeys();

  if (mode === "single") {
    const onOwnKey = singleProvider === JUDGE_SLOT ? judgeActive : isOwnKey(singleProvider);
    if (!onOwnKey) return null;
    const model = byokModelId(singleProvider) ?? "";
    return (
      <div className="byok-plashka byok-plashka--ok" role="status">
        <IconCheck size={15} />
        <span>{t("keys.singleConnected", { model })}</span>
      </div>
    );
  }

  // Compare: only relevant once the user has at least one active own key.
  if (byokPayload() === null) return null;

  const customSlots = activeResponders.filter((r) => r.custom).map((r) => r.slot);
  const slots = [...DEFAULT_RESPONDER_SLOTS, ...customSlots];

  if (allParticipantsOwn(slots)) {
    return (
      <div className="byok-plashka byok-plashka--ok" role="status">
        <IconCheck size={15} />
        <span>{t("keys.compareUnlimited")}</span>
      </div>
    );
  }

  return (
    <div className="byok-plashka byok-plashka--warn" role="status">
      <IconInfo size={15} />
      <span>{t("keys.compareLimitedNotice")}</span>
    </div>
  );
}
