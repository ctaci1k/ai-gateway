// frontend/components/topbar/ThemeToggle.tsx
//
// Moon/sun theme toggle in the topbar (PH24, D1). A sliding knob switches
// dark ↔ light via ThemeContext.toggleTheme(); pixel-matched to cc-styles.

"use client";

import { IconMoon, IconSun } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { useTheme } from "@/store/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      className="cc-theme"
      onClick={toggleTheme}
      aria-label={t(dark ? "theme.toLight" : "theme.toDark")}
      title={t("theme.toggle")}
    >
      <span className="cc-theme-ic">
        <IconMoon size={16} />
      </span>
      <span className="cc-theme-ic">
        <IconSun size={16} />
      </span>
      <span className="cc-theme-knob" aria-hidden="true">
        {dark ? <IconMoon size={15} /> : <IconSun size={15} />}
      </span>
    </button>
  );
}
