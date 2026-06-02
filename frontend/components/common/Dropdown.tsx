// frontend/components/common/Dropdown.tsx
//
// Shared accessible dropdown menu (PH24, A1). One place for the open/close,
// click-outside, Esc, and focus behaviour every topbar menu needs.
//
// - The trigger is rendered via `renderTrigger(open, toggle)` so callers control
//   its markup (pill, icon button, avatar button…).
// - The menu content is `children`, rendered only while open, inside a
//   role="menu" container positioned under the trigger.
// - Clicking outside or pressing Esc closes and returns focus to the trigger.
// - On open, focus moves to the first focusable item; Tab is trapped inside.

"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DropdownProps {
  label: string;
  align?: "left" | "right";
  // Extra class on the positioning wrapper (e.g. for width / menu variant).
  className?: string;
  renderTrigger: (open: boolean, toggle: () => void, triggerId: string) => ReactNode;
  // Menu content; `close` lets items dismiss the menu after acting.
  children: (close: () => void) => ReactNode;
}

export default function Dropdown({
  label,
  align = "right",
  className,
  renderTrigger,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Move focus into the menu on open; restore to the trigger on close.
  useEffect(() => {
    if (!open) return undefined;
    const trigger = document.activeElement as HTMLElement | null;
    const focusables = () =>
      menuRef.current
        ? Array.from(menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
    focusables()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
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
    <div ref={wrapRef} className={["cc-dd", className].filter(Boolean).join(" ")}>
      {renderTrigger(open, toggle, triggerId)}
      {open && (
        <div
          ref={menuRef}
          className={align === "left" ? "cc-menu cc-menu--left" : "cc-menu"}
          role="menu"
          aria-label={label}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
