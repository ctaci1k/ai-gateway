// frontend/services/reportsApi.ts
//
// Typed Usage Reports API (PH27, D-18): per-user aggregations over the
// usage_events ledger + CSV export. All requests go through the shared apiClient
// (cookies + CSRF); components never call fetch directly.

import { API_URL, apiFetch, parseJsonResponse } from "@/services/apiClient";
import type {
  ChatUsage,
  ModelUsage,
  ReportEventsPage,
  ReportSummary,
  TimeseriesResponse,
} from "@/types/api";

// The window the dashboard filters by. `from`/`to` are ISO strings; an absent
// `from` means "all time" (the backend defaults to 30d only when nothing is
// passed, so the UI always sends an explicit `from` except for "all").
export interface ReportRange {
  from?: string;
  to?: string;
}

interface ByModelEnvelope {
  models: ModelUsage[];
}
interface ByChatEnvelope {
  chats: ChatUsage[];
}

function rangeQuery(range: ReportRange, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getSummary(range: ReportRange): Promise<ReportSummary> {
  const response = await apiFetch(`/reports/summary${rangeQuery(range)}`);
  return parseJsonResponse<ReportSummary>(response);
}

export async function getByModel(range: ReportRange): Promise<ModelUsage[]> {
  const response = await apiFetch(`/reports/by-model${rangeQuery(range)}`);
  const data = await parseJsonResponse<ByModelEnvelope>(response);
  return data.models;
}

export async function getByChat(range: ReportRange): Promise<ChatUsage[]> {
  const response = await apiFetch(`/reports/by-chat${rangeQuery(range)}`);
  const data = await parseJsonResponse<ByChatEnvelope>(response);
  return data.chats;
}

export async function getTimeseries(
  range: ReportRange,
  bucket: "day" | "hour",
): Promise<TimeseriesResponse> {
  const response = await apiFetch(`/reports/timeseries${rangeQuery(range, { bucket })}`);
  return parseJsonResponse<TimeseriesResponse>(response);
}

export async function getEvents(
  range: ReportRange,
  cursor: string | null,
  limit = 50,
): Promise<ReportEventsPage> {
  const extra: Record<string, string> = { limit: String(limit) };
  if (cursor) extra.cursor = cursor;
  const response = await apiFetch(`/reports/events${rangeQuery(range, extra)}`);
  return parseJsonResponse<ReportEventsPage>(response);
}

// Direct download URL for the CSV export (opened in a new tab / via <a download>).
// Cookies authenticate the GET; no CSRF needed for a read.
export function eventsCsvUrl(range: ReportRange): string {
  return `${API_URL}/reports/events.csv${rangeQuery(range)}`;
}
