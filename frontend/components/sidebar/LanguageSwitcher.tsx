// frontend/components/sidebar/LanguageSwitcher.tsx

"use client";

import LanguageToggle from "@/components/common/LanguageToggle";
import { useI18n } from "@/store/LanguageContext";

export default function LanguageSwitcher() {
  const { t } = useI18n();

  // Wrapped so the collapsed rail can hide the language picker entirely (PH23/D3).
  return (
    <div className="sb-lang">
      <div className="sb-cap">{t("sidebar.language")}</div>
      <LanguageToggle />
    </div>
  );
}
