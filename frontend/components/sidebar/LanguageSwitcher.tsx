// frontend/components/sidebar/LanguageSwitcher.tsx

"use client";

import LanguageToggle from "@/components/common/LanguageToggle";
import { useI18n } from "@/store/LanguageContext";

export default function LanguageSwitcher() {
  const { t } = useI18n();

  return (
    <>
      <div className="sb-cap">{t("sidebar.language")}</div>
      <LanguageToggle />
    </>
  );
}
