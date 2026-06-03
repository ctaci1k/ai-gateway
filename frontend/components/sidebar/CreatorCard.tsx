// frontend/components/sidebar/CreatorCard.tsx
//
// Creator credit pinned to the bottom-left of the sidebar (PH24, A3) — replaces
// the old "All systems online" corner with who built the app. Copy via i18n.

"use client";

import { IconCode } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

export default function CreatorCard() {
  const { t } = useI18n();

  return (
    <div className="cc-creator">
      <div className="cc-creator-badge" aria-hidden="true">
        <IconCode size={17} />
      </div>
      <div className="cc-creator-tx">
        <small>{t("author.cap")}</small>
        <b>{t("author.name")}</b>
        <span>{t("author.tagline")}</span>
      </div>
    </div>
  );
}
