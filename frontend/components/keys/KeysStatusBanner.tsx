// frontend/components/keys/KeysStatusBanner.tsx
//
// BYOK status plashka shown above the limit banner (PH17, step 7):
//   - Single: a green "connected — no limits" plashka when the selected model
//     runs on the user's own key (the judge model is selectable here too, NQ6).
//   - Compare: green when every participant (responders + judge) is on own keys
//     (unlimited), red "available with limits" when some — but not all — are.
// Nothing shows when the user has no active own keys (the limit banner covers
// the default, app-key case).
//
// The state itself comes from the single source useSidebarStatus (PH23/D1) so
// this full banner and the collapsed-rail squares never diverge.

"use client";

import { IconCheck, IconInfo } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { useSidebarStatus } from "@/store/sidebarStatus";

export default function KeysStatusBanner() {
  const { t } = useI18n();
  const { byok } = useSidebarStatus();

  if (!byok) return null;

  if (byok.tone === "ok") {
    const text =
      byok.kind === "single"
        ? t("keys.singleConnected", { model: byok.model })
        : t("keys.compareUnlimited");
    return (
      <div className="byok-plashka byok-plashka--ok" role="status">
        <IconCheck size={15} />
        <span>{text}</span>
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
