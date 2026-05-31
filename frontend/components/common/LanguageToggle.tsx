// frontend/components/common/LanguageToggle.tsx
//
// Shared presentational language switcher — a row of locale pills (EN/PL/UA).
// Used by the sidebar (with a caption) and the auth screen, so the switch logic
// and styling live in one place. `type="button"` matters: on the auth screen the
// toggle sits inside a <form>, and without it a click would submit the form.

"use client";

import { useI18n } from "@/store/LanguageContext";

export default function LanguageToggle() {
  const { t, lang, setLang, locales } = useI18n();

  return (
    <div className="langs" role="group" aria-label={t("sidebar.language")}>
      {locales.map((loc) => {
        const active = lang === loc.code;
        return (
          <button
            key={loc.code}
            type="button"
            className={active ? "lang lang--active" : "lang"}
            aria-pressed={active}
            onClick={() => setLang(loc.code)}
          >
            {loc.label}
          </button>
        );
      })}
    </div>
  );
}
