// frontend/components/common/InfoTip.tsx
//
// Shared accessible info tooltip (PH29, plan 027). A small ⓘ button that toggles
// a popover note explaining a field (where to get a key, what a model id is,
// how it pairs with the base URL). One place for the open/close, Esc,
// click-outside and focus behaviour every BYOK field tip needs.
//
// a11y: the button has an aria-label and aria-describedby pointing at the
// popover (role="note"); Esc closes and returns focus to the button; a pointer
// down outside closes it. Built on design tokens — no hardcoded colour.

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { IconInfo } from "@/components/icons/Icons";

interface InfoTipProps {
  // Accessible name for the trigger button (e.g. "Help: API key").
  label: string;
  // The explanatory text shown in the popover.
  text: string;
}

export default function InfoTip({ label, text }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  const close = useCallback(() => setOpen(false), []);

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

  return (
    <span ref={wrapRef} className="keys-infotip">
      <button
        ref={buttonRef}
        type="button"
        className="keys-info"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <IconInfo size={15} />
      </button>
      {open && (
        <span id={popoverId} className="keys-info-popover" role="note">
          {text}
        </span>
      )}
    </span>
  );
}
