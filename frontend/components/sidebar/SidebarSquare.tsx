// frontend/components/sidebar/SidebarSquare.tsx
//
// Compact colored square shown only in the collapsed desktop rail (PH23/D2–D3).
// One presentational primitive reused for every rail indicator — status,
// author ("SB"), BYOK ("API") — so colors/sizing live in a single CSS class.
// Tone maps to a design token (ok → success, danger → danger, neutral → border).
// Always carries a tooltip (title) + aria-label; interactive when onClick is set.

"use client";

import type { ReactNode } from "react";

interface SidebarSquareProps {
  tone?: "ok" | "danger" | "neutral";
  // Tooltip + accessible name (the visible glyph alone isn't descriptive).
  label: string;
  children: ReactNode;
  onClick?: () => void;
}

export default function SidebarSquare({
  tone = "neutral",
  label,
  children,
  onClick,
}: SidebarSquareProps) {
  const className = `rail-sq rail-sq--${tone}`;

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        title={label}
        aria-label={label}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={className} role="status" title={label} aria-label={label}>
      {children}
    </div>
  );
}
