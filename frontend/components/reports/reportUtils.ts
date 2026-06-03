// frontend/components/reports/reportUtils.ts
//
// Shared helpers for the Usage Reports dashboard (PH27, D-18): period-range
// presets, number formatting and model labelling. No fetch here (services only).

import { useEffect, useState } from "react";

import type { ReportRange } from "@/services/reportsApi";
import { modelDisplay, responderLabel } from "@/utils/models";

export type RangePreset = "24h" | "7d" | "30d" | "all" | "custom";

// "All time": the backend defaults a missing `from` to 30 days, so we send an
// explicit epoch lower bound to mean "everything".
const EPOCH_ISO = "1970-01-01T00:00:00Z";

const DAY_MS = 24 * 60 * 60 * 1000;

// Resolve a preset (+ optional custom YYYY-MM-DD inputs) into a `from`/`to`
// window. Presets omit `to` (= now). Custom spans whole local days.
export function presetToRange(
  preset: RangePreset,
  nowMs: number,
  customFrom?: string,
  customTo?: string,
): ReportRange {
  if (preset === "all") return { from: EPOCH_ISO };
  if (preset === "custom") {
    const range: ReportRange = {};
    if (customFrom) range.from = new Date(`${customFrom}T00:00:00`).toISOString();
    if (customTo) range.to = new Date(`${customTo}T23:59:59`).toISOString();
    if (!range.from) range.from = EPOCH_ISO;
    return range;
  }
  const days = preset === "24h" ? 1 : preset === "7d" ? 7 : 30;
  return { from: new Date(nowMs - days * DAY_MS).toISOString() };
}

// Pick the timeseries bucket granularity for a preset (hourly for 24h, else day).
export function bucketForPreset(preset: RangePreset): "day" | "hour" {
  return preset === "24h" ? "hour" : "day";
}

// Thousands-separated integer (viewer locale).
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString();
}

// Token figure with a leading "~" when the value is (or may be) an estimate.
export function formatTokens(value: number, estimated: boolean): string {
  return `${estimated ? "~" : ""}${formatInt(value)}`;
}

// 0..1 success rate as a percent string.
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// Truthful model label for a selected_model key; BYOK/custom slots fall back to
// the raw id. null → an em-dash.
export function modelLabel(model: string | null): string {
  if (!model) return "—";
  return responderLabel(model);
}

// Truthful model label for a report row that carries the real model (PH32, D-22).
// ``model`` is the slot (selected_model); ``model_name`` is the denormalized real
// model; key-source is inferred from ``key_fingerprint`` (own key ⇒ show the real
// model). Built-in rows fall back to the friendly slot label; legacy own-key rows
// without a real model also fall back to the slot. Used by the model-attributed
// tabs (By-model / Breakdown / Activity); By-chat uses a chat-level fallback.
export function reportModel(row: {
  model: string | null;
  model_name: string | null;
  key_fingerprint: string | null;
}): string {
  return modelDisplay(row.model, row.model_name, !!row.key_fingerprint);
}

// Key-source attribution for a report row (PH31, D-21). A null fingerprint means
// the turn ran on the app's built-in key; otherwise it carries the display-only
// mask (first4••••last4). The translatable "built-in" label is rendered by the
// component (texts go through t()); this util only classifies + exposes the mask.
export function keySource(fingerprint: string | null | undefined): {
  builtin: boolean;
  mask: string | null;
} {
  const mask = (fingerprint ?? "").trim();
  return mask ? { builtin: false, mask } : { builtin: true, mask: null };
}

// The API serializes naive UTC without a tz designator; append `Z` so the
// browser parses it as UTC (mirrors utils/relativeTime::parseUtc).
function parseUtcMs(iso: string): number {
  const hasTz = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso.trim());
  return Date.parse(hasTz ? iso : `${iso}Z`);
}

// Localized date (no time) for a naive-UTC ISO timestamp.
export function formatDate(iso: string): string {
  const ms = parseUtcMs(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleDateString();
}

// Localized date + time for a naive-UTC ISO timestamp.
export function formatDateTime(iso: string): string {
  const ms = parseUtcMs(iso);
  return Number.isNaN(ms)
    ? "—"
    : new Date(ms).toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

// Axis label for a timeseries bucket: hour for hourly buckets, else date.
export function formatBucketLabel(iso: string, bucket: "day" | "hour"): string {
  const ms = parseUtcMs(iso);
  if (Number.isNaN(ms)) return "—";
  const date = new Date(ms);
  return bucket === "hour"
    ? date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Mount-once fetch hook (project pattern, mirrors AdminPanel): state is set only
// inside async callbacks, never synchronously in the effect, so it satisfies
// react-hooks/set-state-in-effect. Callers remount the component (a `key` on the
// active range) to re-fetch when the window changes. `data === null && !error`
// means loading.
export function useReportData<T>(loader: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  error: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    loader()
      .then((result) => {
        if (active) {
          setData(result);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading: data === null && !error, error };
}
