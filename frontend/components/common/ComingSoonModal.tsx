// frontend/components/common/ComingSoonModal.tsx
//
// Shared "in development" stub modal (PH24, F1). Opened from the account menu
// (Profile & Avatar, Security) and the topbar (Reports — for every user). One
// accessible dialog (role="dialog", aria-modal, Esc/backdrop to close, focus
// trap) with a localized title + description and a single Close button.

"use client";

import { useCallback, useEffect, useRef } from "react";

import { IconClose, IconSparkle } from "@/components/icons/Icons";
import { useComingSoon } from "@/store/ComingSoonContext";
import { useI18n } from "@/store/LanguageContext";

export default function ComingSoonModal() {
  const { t } = useI18n();
  const { topic, close } = useComingSoon();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!topic) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused.current?.focus();
  }, [topic]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Single focusable (Close): Esc closes; Tab keeps focus on it (trap).
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    },
    [close],
  );

  if (!topic) return null;

  const title = t(`comingSoon.${topic}.title`);
  const desc = t(`comingSoon.${topic}.desc`);

  return (
    <div className="dialog-backdrop" onMouseDown={close}>
      <div
        className="dialog coming-soon"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coming-soon-title"
        aria-describedby="coming-soon-desc"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="coming-soon-badge" aria-hidden="true">
          <IconSparkle size={22} />
        </div>
        <span className="coming-soon-tag">{t("comingSoon.tag")}</span>
        <h2 id="coming-soon-title" className="dialog-title">
          {title}
        </h2>
        <p id="coming-soon-desc" className="dialog-message">
          {desc}
        </p>
        <div className="dialog-actions">
          <button
            ref={closeRef}
            type="button"
            className="dialog-btn dialog-btn--primary"
            onClick={close}
          >
            {t("comingSoon.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
