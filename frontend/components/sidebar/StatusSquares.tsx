// frontend/components/sidebar/StatusSquares.tsx
//
// Collapsed-rail status indicators (PH23/D2). Renders the same state the full
// banners show (KeysStatusBanner + LimitBanner) but as compact colored squares,
// driven by the single source useSidebarStatus (D1) — no duplicated logic.
//   - limited account            → red square
//   - partial Compare key set    → red square (a separate indicator)
//   - own key (single / all own) → green square
// Each square has a tooltip + aria-label. Visible only in the collapsed rail
// (the wrapper is rail-only); CSS hides it when expanded or in the mobile drawer.

"use client";

import { IconCheck, IconInfo } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { useSidebarStatus } from "@/store/sidebarStatus";

import SidebarSquare from "./SidebarSquare";

export default function StatusSquares() {
  const { t } = useI18n();
  const { byok, limited } = useSidebarStatus();

  if (!limited && !byok) return null;

  return (
    <div className="rail-only rail-squares">
      {limited && (
        <SidebarSquare tone="danger" label={t("status.limited")}>
          <IconInfo size={15} />
        </SidebarSquare>
      )}
      {byok?.tone === "ok" && (
        <SidebarSquare
          tone="ok"
          label={byok.kind === "single" ? t("status.ownKey") : t("status.compareUnlimited")}
        >
          <IconCheck size={15} />
        </SidebarSquare>
      )}
      {byok?.tone === "warn" && (
        <SidebarSquare tone="danger" label={t("status.comparePartial")}>
          <IconInfo size={15} />
        </SidebarSquare>
      )}
    </div>
  );
}
