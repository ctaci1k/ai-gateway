// frontend/components/settings/LanguageSection.tsx
//
// Settings → Language (PH38). Third settings section, mirroring the structure of
// JudgePromptSection: settings-section-body → settings-h + settings-desc, then a
// radiogroup listing every locale (flag + native name, a check on the active
// one). Selecting a language applies immediately via setLang (it persists to
// localStorage and updates <html lang>), so there is no Save button. Flags and
// native names come from the single LOCALES source (i18n/index).

"use client";

import { IconCheck } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

export default function LanguageSection() {
  const { t, lang, setLang, locales } = useI18n();

  return (
    <div className="settings-section-body">
      <h3 className="settings-h">{t("settings.language.title")}</h3>
      <p className="settings-desc">{t("settings.language.desc")}</p>

      <div className="settings-lang-list" role="radiogroup" aria-label={t("settings.nav.language")}>
        {locales.map((loc) => {
          const active = lang === loc.code;
          return (
            <button
              key={loc.code}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              className={active ? "settings-lang-item is-sel" : "settings-lang-item"}
              onClick={() => setLang(loc.code)}
            >
              <span className="settings-lang-flag" aria-hidden="true">
                {loc.flag}
              </span>
              <span className="settings-lang-name">{loc.nativeName}</span>
              {active && <IconCheck size={16} className="settings-lang-chk" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
