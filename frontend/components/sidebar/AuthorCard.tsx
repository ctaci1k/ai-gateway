// frontend/components/sidebar/AuthorCard.tsx
//
// Author signature in the lower-left zone (where System Log used to be, PH14/9).
// Concise name + one line stating the app demonstrates building a real, large,
// working product solo. All copy via i18n (uk/pl/en).

"use client";

import { useI18n } from "@/store/LanguageContext";

export default function AuthorCard() {
  const { t } = useI18n();

  return (
    <div className="author-card">
      <div className="author-cap">{t("author.cap")}</div>
      <div className="author-name">{t("author.name")}</div>
      <p className="author-tagline">{t("author.tagline")}</p>
    </div>
  );
}
