// frontend/utils/relativeTime.ts
//
// Compact relative time for chat-history rows (PH24, C1). Buckets:
//   <60s              → "just now"
//   <60min            → "N min ago"
//   <24h              → "N h ago"
//   otherwise         → "N d ago"   (no weekday names — owner decision)
//
// The component supplies the localized templates via `t()` (golden rule: no
// hardcoded copy here). `{n}` is interpolated by the i18n engine.

export interface RelativeTimeLabels {
  justNow: string; // "just now"
  minutes: string; // "{n} min ago"
  hours: string; // "{n} h ago"
  days: string; // "{n} d ago"
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// The API serializes timestamps as naive UTC WITHOUT a timezone designator (the
// backend stores naive UTC for Postgres compatibility, e.g. "2026-06-02T10:11:53").
// JS `Date.parse` treats a date-time string with no offset as LOCAL time, which
// skews relative times by the viewer's UTC offset (e.g. +2h → a fresh chat reads
// "2h ago"). Normalize: if there's no trailing `Z` or ±HH:MM offset, it's UTC, so
// append `Z` before parsing. Strings that already carry a timezone are untouched.
function parseUtc(iso: string): number {
  const hasTz = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso.trim());
  return Date.parse(hasTz ? iso : `${iso}Z`);
}

// Returns the i18n key + interpolation vars for the given timestamps. Kept pure
// (caller passes `now`) so it is deterministic and unit-testable.
export function relativeTimeParts(
  iso: string,
  nowMs: number,
): { key: keyof RelativeTimeLabels; n: number } {
  const then = parseUtc(iso);
  // Guard against future skew / unparseable input → treat as "just now".
  const seconds = Number.isNaN(then) ? 0 : Math.max(0, Math.floor((nowMs - then) / 1000));

  if (seconds < MINUTE) return { key: "justNow", n: 0 };
  if (seconds < HOUR) return { key: "minutes", n: Math.floor(seconds / MINUTE) };
  if (seconds < DAY) return { key: "hours", n: Math.floor(seconds / HOUR) };
  return { key: "days", n: Math.floor(seconds / DAY) };
}

// Resolve to a localized string given the four templates. `justNow` ignores {n}.
export function formatRelativeTime(iso: string, nowMs: number, labels: RelativeTimeLabels): string {
  const { key, n } = relativeTimeParts(iso, nowMs);
  const template = labels[key];
  return template.replace(/\{n\}/g, String(n));
}
