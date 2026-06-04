// frontend/components/sidebar/CreatorCard.tsx
//
// Creator credit pinned to the bottom-left of the sidebar (PH24, A3) — replaces
// the old "All systems online" corner with who built the app. Copy via i18n.
//
// PH35/S13: the SAME component is reused inside the account menu on mobile (the
// `variant="menu"` modifier), so the card is never copy-pasted. Which copy is
// visible is decided by CSS (sidebar one hidden ≤768px, menu one shown ≤768px).

"use client";

import { IconCode } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

export default function CreatorCard({ variant = "sidebar" }: { variant?: "sidebar" | "menu" }) {
  const { t } = useI18n();

  const className = variant === "menu" ? "cc-creator cc-creator--menu" : "cc-creator";

  return (
    <div className={className}>
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
