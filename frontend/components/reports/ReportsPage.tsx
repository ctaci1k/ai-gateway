// frontend/components/reports/ReportsPage.tsx
//
// Usage Reports dashboard as a full-page view (PH28, Variant B) — replaces the
// cramped modal. Mirrors AdminPanel: rendered in the main content area by
// app/page.tsx when the Reports view is open. Header + sticky toolbar (period +
// access-key filter) + tab nav (Overview / Breakdown / Models / Chats / Log).

"use client";

import { useMemo, useState } from "react";

import { IconClose, IconReport } from "@/components/icons/Icons";
import ActivityLogTab from "@/components/reports/ActivityLogTab";
import BreakdownTab from "@/components/reports/BreakdownTab";
import ByChatTab from "@/components/reports/ByChatTab";
import ByModelTab from "@/components/reports/ByModelTab";
import OverviewTab from "@/components/reports/OverviewTab";
import { bucketForPreset, presetToRange, type RangePreset } from "@/components/reports/reportUtils";
import type { ReportRange } from "@/services/reportsApi";
import { useI18n } from "@/store/LanguageContext";
import { useReports } from "@/store/ReportsContext";
import type { ReportAccess } from "@/types/api";

type ReportTab = "overview" | "breakdown" | "models" | "chats" | "log";
const PRESETS: RangePreset[] = ["24h", "7d", "30d", "all", "custom"];
const ACCESS_OPTIONS: { value: ReportAccess | "all"; key: string }[] = [
  { value: "all", key: "reports.access.all" },
  { value: "app", key: "reports.access.app" },
  { value: "own", key: "reports.access.own" },
];

export default function ReportsPage() {
  const { t } = useI18n();
  const { target, close } = useReports();

  const [tab, setTab] = useState<ReportTab>("overview");
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [access, setAccess] = useState<ReportAccess | "all">("all");
  const [nowMs] = useState(() => Date.now());

  const range = useMemo<ReportRange>(() => {
    const base = presetToRange(preset, nowMs, customFrom, customTo);
    return access === "all" ? base : { ...base, access };
  }, [preset, nowMs, customFrom, customTo, access]);

  const rangeKey = `${range.from ?? ""}|${range.to ?? ""}|${access}`;
  const bucket = bucketForPreset(preset);
  const readOnly = target !== null;

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "overview", label: t("reports.tab.overview") },
    { id: "breakdown", label: t("reports.tab.breakdown") },
    { id: "models", label: t("reports.tab.models") },
    { id: "chats", label: t("reports.tab.chats") },
    { id: "log", label: t("reports.tab.log") },
  ];

  return (
    <section className="rep-page" aria-label={t("reports.title")}>
      <div className="rep-page-head">
        <h1 className="rep-page-title">
          <IconReport size={20} />
          {t("reports.title")}
          {readOnly && target && <span className="rep-title-sub">· {target.username}</span>}
        </h1>
        <button type="button" className="rep-back" onClick={close}>
          <IconClose size={15} />
          {t("reports.back")}
        </button>
      </div>

      <div className="rep-toolbar">
        <div className="rep-range-presets" role="group" aria-label={t("reports.range.label")}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={p === preset ? "rep-range-btn is-active" : "rep-range-btn"}
              aria-pressed={p === preset}
              onClick={() => setPreset(p)}
            >
              {t(`reports.range.${p}`)}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="rep-range-custom">
            <label className="rep-range-field">
              <span>{t("reports.range.from")}</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>
            <label className="rep-range-field">
              <span>{t("reports.range.to")}</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="rep-toolbar-spacer" />

        <div className="rep-access" role="group" aria-label={t("reports.access.label")}>
          {ACCESS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={opt.value === access ? "rep-range-btn is-active" : "rep-range-btn"}
              aria-pressed={opt.value === access}
              onClick={() => setAccess(opt.value)}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </div>

      <nav className="rep-tabs" aria-label={t("reports.title")}>
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            className={tabItem.id === tab ? "rep-tab is-active" : "rep-tab"}
            aria-current={tabItem.id === tab ? "true" : undefined}
            onClick={() => setTab(tabItem.id)}
          >
            {tabItem.label}
          </button>
        ))}
      </nav>

      {/* Remount the active tab when the effective filter changes (key=rangeKey)
          so its mount-once fetch re-runs without synchronous setState. */}
      <div className="rep-page-content">
        {tab === "overview" && (
          <OverviewTab key={`${rangeKey}|${bucket}`} range={range} bucket={bucket} />
        )}
        {tab === "breakdown" && <BreakdownTab key={rangeKey} range={range} readOnly={readOnly} />}
        {tab === "models" && <ByModelTab key={rangeKey} range={range} />}
        {tab === "chats" && (
          <ByChatTab key={rangeKey} range={range} nowMs={nowMs} readOnly={readOnly} />
        )}
        {tab === "log" && <ActivityLogTab key={rangeKey} range={range} />}
      </div>
    </section>
  );
}
