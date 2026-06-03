// frontend/components/keys/ProviderGuide.tsx
//
// "Where to get keys & models?" directory (PH30, plan 028 / Block E2). A button
// next to the BYOK intro that opens an accessible panel listing every provider
// with deep links to its API-keys page and its models list. A no-auth provider
// (if any) is marked as needing no key. No logos (owner decision).
//
// External links ONLY open provider docs in a new tab — no keys or data ever
// leave the app (D-12/D-20 untouched). All links are target="_blank"
// rel="noopener noreferrer" with ≥44px hit targets and focus-visible rings.
//
// a11y: Esc closes and returns focus to the trigger; a pointer-down outside
// closes; the panel is role="dialog" + aria-label. Built on design tokens.

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { IconInfo } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { ALL_PROVIDER_LINKS } from "@/utils/byokEndpoints";

export default function ProviderGuide() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="keys-guide" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="keys-guide-trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <IconInfo size={15} />
        {t("keys.whereToGet")}
      </button>
      {open && (
        <div
          id={panelId}
          className="keys-guide-panel"
          role="dialog"
          aria-label={t("keys.providerGuideTitle")}
        >
          <p className="keys-guide-title">{t("keys.providerGuideTitle")}</p>
          <ul className="keys-guide-list">
            {ALL_PROVIDER_LINKS.map((p) => (
              <li key={p.id} className="keys-guide-item">
                <span className="keys-guide-name">{p.label}</span>
                <span className="keys-guide-links">
                  {p.needsKey ? (
                    <a
                      className="keys-guide-link"
                      href={p.keysUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={close}
                    >
                      {t("keys.getKey")} ↗
                    </a>
                  ) : (
                    <span className="keys-guide-nokey">{t("keys.ollamaNoKey")}</span>
                  )}
                  <a
                    className="keys-guide-link"
                    href={p.modelsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                  >
                    {t("keys.getModels")} ↗
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
