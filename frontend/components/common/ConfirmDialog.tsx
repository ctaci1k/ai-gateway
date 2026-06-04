// frontend/components/common/ConfirmDialog.tsx
//
// Accessible confirmation dialog (PH16/A1): role="dialog" + aria-modal, focus
// trap, Esc to cancel, backdrop click to cancel, focus returned to the trigger
// on close. Styling is token-based (theme/components.css).
//
// Rendered through a portal into document.body so the fixed-position overlay is
// valid wherever it's used (e.g. inside a <tbody>, where a bare <div> would be
// invalid HTML and break hydration) and never clipped by an ancestor's overflow.

"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Move focus into the dialog when it opens; restore it when it closes.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => previouslyFocused.current?.focus();
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      // Trap Tab focus between the two actions.
      if (event.key === "Tab") {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onCancel],
  );

  // Closed, or no DOM yet (SSR) → render nothing. The portal target is body.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id="dialog-title" className="dialog-title">
          {title}
        </h2>
        <p id="dialog-message" className="dialog-message">
          {message}
        </p>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="dialog-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="dialog-btn dialog-btn--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
