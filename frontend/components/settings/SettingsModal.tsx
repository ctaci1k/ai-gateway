// frontend/components/settings/SettingsModal.tsx
//
// Settings modal (PH24, E1): a real settings screen with a left section list and
// a content pane. Accessible — role="dialog", aria-modal, Esc to close, focus
// moved in on open and restored on close, Tab trapped. Responsive: the section
// list collapses above the content on narrow screens (CSS).
//
// Sections: Judge prompt (E2) and API Keys / BYOK (E3).

"use client";

import { useCallback, useEffect, useRef } from "react";

import { IconClose, IconGear, IconSparkle } from "@/components/icons/Icons";
import ApiKeysSection from "@/components/settings/ApiKeysSection";
import JudgePromptSection from "@/components/settings/JudgePromptSection";
import { useI18n } from "@/store/LanguageContext";
import { useSettings, type SettingsSection } from "@/store/SettingsContext";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { section, setSection } = useSettings();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
    focusables()[0]?.focus();
    return () => previouslyFocused.current?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "judge", label: t("settings.nav.judge"), icon: <IconSparkle size={16} /> },
    { id: "keys", label: t("settings.nav.keys"), icon: <IconGear size={16} /> },
  ];

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="settings-head">
          <h2 id="settings-title" className="dialog-title">
            {t("settings.title")}
          </h2>
          <button
            type="button"
            className="keys-close"
            aria-label={t("common.cancel")}
            onClick={onClose}
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="settings-grid">
          <nav className="settings-nav" aria-label={t("settings.title")}>
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === section ? "settings-nav-item is-active" : "settings-nav-item"}
                aria-current={s.id === section ? "true" : undefined}
                onClick={() => setSection(s.id)}
              >
                <span className="settings-nav-ic">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-content thin-scroll">
            {section === "judge" && <JudgePromptSection />}
            {section === "keys" && <ApiKeysSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsModal() {
  const { isOpen, close } = useSettings();
  if (!isOpen) return null;
  return <SettingsDialog onClose={close} />;
}
