// frontend/components/topbar/LangMenu.tsx
//
// Topbar language dropdown (PH24, D1) — replaces the sidebar language pills. A
// pill trigger shows the current locale; the menu lists all locales with a check
// on the active one. Built on the shared a11y Dropdown.

"use client";

import Dropdown from "@/components/common/Dropdown";
import { IconCheck, IconChevron } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import type { LocaleCode } from "@/i18n";

const FLAGS: Record<LocaleCode, string> = { en: "🇬🇧", pl: "🇵🇱", uk: "🇺🇦" };
// Full language names per locale code (kept short; not user-authored copy).
const NAMES: Record<LocaleCode, string> = {
  en: "English",
  pl: "Polski",
  uk: "Українська",
};

export default function LangMenu() {
  const { t, lang, setLang, locales } = useI18n();

  return (
    <Dropdown
      label={t("sidebar.language")}
      className="cc-dd-lang"
      renderTrigger={(open, toggle) => (
        <button
          type="button"
          className={open ? "cc-langpill is-open" : "cc-langpill"}
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("sidebar.language")}
        >
          <span className="cc-flag" aria-hidden="true">
            {FLAGS[lang]}
          </span>
          <b>{lang.toUpperCase()}</b>
          <IconChevron size={13} style={{ opacity: 0.6 }} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="cc-menu-cap">{t("sidebar.language")}</div>
          {locales.map((loc) => {
            const active = lang === loc.code;
            return (
              <button
                key={loc.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={active ? "cc-menu-item is-sel" : "cc-menu-item"}
                onClick={() => {
                  setLang(loc.code);
                  close();
                }}
              >
                <span className="cc-menu-flag" aria-hidden="true">
                  {FLAGS[loc.code]}
                </span>
                <span className="lab">{NAMES[loc.code]}</span>
                {active && <IconCheck size={15} className="chk" />}
              </button>
            );
          })}
        </>
      )}
    </Dropdown>
  );
}
