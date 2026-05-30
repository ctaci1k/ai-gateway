// frontend/components/sidebar/LanguageSwitcher.tsx

"use client";

import { useI18n } from "@/store/LanguageContext";

export default function LanguageSwitcher() {
  const { t, lang, setLang, locales } = useI18n();

  return (
    <>
      <div className="sb-cap">{t("sidebar.language")}</div>
      <div className="langs">
        {locales.map((loc) => {
          const active = lang === loc.code;
          return (
            <button
              key={loc.code}
              className={active ? "lang lang--active" : "lang"}
              aria-pressed={active}
              onClick={() => setLang(loc.code)}
            >
              {loc.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
