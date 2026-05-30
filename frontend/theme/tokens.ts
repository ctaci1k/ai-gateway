// frontend/theme/tokens.ts
//
// Canonical names of the semantic design tokens (the values live in
// theme/tokens.css). Use these to avoid drift when referencing tokens in TS,
// and the Tailwind utility names below in JSX class strings.

export const SEMANTIC_TOKENS = [
  "bg",
  "panel",
  "panel-2",
  "sidebar",
  "card",
  "border",
  "border-strong",
  "fg",
  "muted",
  "subtle",
  "accent",
  "accent-contrast",
  "success",
  "danger",
  "danger-surface",
  "warning",
] as const;

export type SemanticToken = (typeof SEMANTIC_TOKENS)[number];

export type ThemeName = "dark" | "light";

export const THEMES: ThemeName[] = ["dark", "light"];
export const DEFAULT_THEME: ThemeName = "dark";
