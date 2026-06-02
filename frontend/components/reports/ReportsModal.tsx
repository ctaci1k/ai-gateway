// frontend/components/reports/ReportsModal.tsx
//
// Usage Reports dashboard (PH27, E1): a modal with a left tab list (Overview /
// Models / Chats / Activity log) + a period-range filter applied to every tab.
// Accessible — role="dialog", aria-modal, Esc to close, focus trapped + restored.
// Responsive: the tab list collapses above the content on narrow screens (CSS),
// mirroring SettingsModal.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IconClose, IconReport } from "@/components/icons/Icons";
import ActivityLogTab from "@/components/reports/ActivityLogTab";
import ByChatTab from "@/components/reports/ByChatTab";
import ByModelTab from "@/components/reports/ByModelTab";
import OverviewTab from "@/components/reports/OverviewTab";
import { bucketForPreset, presetToRange, type RangePreset } from "@/components/reports/reportUtils";
import { useI18n } from "@/store/LanguageContext";
import { useReports } from "@/store/ReportsContext";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ReportTab = "overview" | "models" | "chats" | "log";
const PRESETS: RangePreset[] = ["24h", "7d", "30d", "all", "custom"];

function ReportsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { target } = useReports();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [tab, setTab] = useState<ReportTab>("overview");
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Anchor "now" once per open so relative times + ranges stay stable.
  const [nowMs] = useState(() => Date.now());

  const range = useMemo(
    () => presetToRange(preset, nowMs, customFrom, customTo),
    [preset, nowMs, customFrom, customTo],
  );
  // A stable key so child tabs refetch only when the effective window changes.
  const rangeKey = `${range.from ?? ""}|${range.to ?? ""}`;
  const bucket = bucketForPreset(preset);
  const readOnly = target !== null;

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
    focusables()[0]?.focus();
    return () => previouslyFocused.current?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
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
    },
    [onClose],
  );

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "overview", label: t("reports.tab.overview") },
    { id: "models", label: t("reports.tab.models") },
    { id: "chats", label: t("reports.tab.chats") },
    { id: "log", label: t("reports.tab.log") },
  ];

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="dialog settings-dialog rep-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="settings-head">
          <h2 id="reports-title" className="dialog-title rep-title">
            <IconReport size={18} />
            {t("reports.title")}
            {readOnly && target && <span className="rep-title-sub">· {target.username}</span>}
          </h2>
          <button
            type="button"
            className="keys-close"
            aria-label={t("common.cancel")}
            onClick={onClose}
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Period filter — applies to every tab. */}
        <div className="rep-rangebar">
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
        </div>

        <div className="settings-grid rep-grid">
          <nav className="settings-nav rep-nav" aria-label={t("reports.title")}>
            {tabs.map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                className={tabItem.id === tab ? "settings-nav-item is-active" : "settings-nav-item"}
                aria-current={tabItem.id === tab ? "true" : undefined}
                onClick={() => setTab(tabItem.id)}
              >
                <span>{tabItem.label}</span>
              </button>
            ))}
          </nav>

          {/* Each tab remounts when the effective window changes (key=rangeKey)
              so its mount-once fetch re-runs with no synchronous setState. */}
          <div className="settings-content rep-content thin-scroll">
            {tab === "overview" && (
              <OverviewTab key={`${rangeKey}|${bucket}`} range={range} bucket={bucket} />
            )}
            {tab === "models" && <ByModelTab key={rangeKey} range={range} />}
            {tab === "chats" && (
              <ByChatTab key={rangeKey} range={range} nowMs={nowMs} readOnly={readOnly} />
            )}
            {tab === "log" && <ActivityLogTab key={rangeKey} range={range} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsModal() {
  const { isOpen, close } = useReports();
  if (!isOpen) return null;
  return <ReportsDialog onClose={close} />;
}
