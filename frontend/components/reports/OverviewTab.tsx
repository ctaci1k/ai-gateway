// frontend/components/reports/OverviewTab.tsx
//
// Usage Reports — Overview (PH27, E2): KPI cards, an activity chart (requests +
// tokens over time) and Single/Compare + billable/own-key split bars.

"use client";

import MiniChart from "@/components/reports/MiniChart";
import { RepError, RepLoading } from "@/components/reports/RepState";
import {
  formatBucketLabel,
  formatInt,
  formatPercent,
  formatTokens,
  useReportData,
} from "@/components/reports/reportUtils";
import { getSummary, getTimeseries, type ReportRange } from "@/services/reportsApi";
import { useI18n } from "@/store/LanguageContext";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseUtcMs(iso: string): number {
  const hasTz = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso.trim());
  return Date.parse(hasTz ? iso : `${iso}Z`);
}

interface OverviewTabProps {
  range: ReportRange;
  bucket: "day" | "hour";
}

function SplitBar({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
}) {
  const total = a + b;
  const aPct = total > 0 ? (a / total) * 100 : 0;
  const bPct = total > 0 ? (b / total) * 100 : 0;
  return (
    <div className="rep-split">
      <div className="rep-split-bar" role="presentation">
        <span className="rep-split-seg rep-split-seg--a" style={{ width: `${aPct}%` }} />
        <span className="rep-split-seg rep-split-seg--b" style={{ width: `${bPct}%` }} />
      </div>
      <div className="rep-split-legend">
        <span>
          <i className="rep-dot rep-dot--a" aria-hidden="true" />
          {aLabel} · {formatInt(a)}
        </span>
        <span>
          <i className="rep-dot rep-dot--b" aria-hidden="true" />
          {bLabel} · {formatInt(b)}
        </span>
      </div>
    </div>
  );
}

export default function OverviewTab({ range, bucket }: OverviewTabProps) {
  const { t } = useI18n();

  const summaryState = useReportData(() => getSummary(range));
  const seriesState = useReportData(() => getTimeseries(range, bucket));

  if (summaryState.loading) return <RepLoading />;
  if (summaryState.error || !summaryState.data) return <RepError />;

  const s = summaryState.data;

  // Average requests per day across the active span (first..last event).
  let avgPerDay = 0;
  if (s.total_requests > 0 && s.first_event && s.last_event) {
    const spanMs = parseUtcMs(s.last_event) - parseUtcMs(s.first_event);
    const days = Math.max(1, Math.ceil(spanMs / DAY_MS) || 1);
    avgPerDay = s.total_requests / days;
  }

  const series = seriesState.data?.points ?? [];

  return (
    <div className="rep-overview">
      <div className="rep-kpis">
        <div className="rep-kpi">
          <span className="rep-kpi-label">{t("reports.kpi.requests")}</span>
          <span className="rep-kpi-value">{formatInt(s.total_requests)}</span>
        </div>
        <div className="rep-kpi">
          <span className="rep-kpi-label">{t("reports.kpi.tokens")}</span>
          <span className="rep-kpi-value">{formatTokens(s.total_tokens, s.tokens_estimated)}</span>
          {s.tokens_estimated && (
            <span className="rep-badge rep-badge--est">{t("reports.badge.estimate")}</span>
          )}
        </div>
        <div className="rep-kpi">
          <span className="rep-kpi-label">{t("reports.kpi.chats")}</span>
          <span className="rep-kpi-value">{formatInt(s.distinct_chats)}</span>
        </div>
        <div className="rep-kpi">
          <span className="rep-kpi-label">{t("reports.kpi.avgPerDay")}</span>
          <span className="rep-kpi-value">{avgPerDay.toFixed(1)}</span>
        </div>
        <div className="rep-kpi">
          <span className="rep-kpi-label">{t("reports.kpi.successRate")}</span>
          <span className="rep-kpi-value">{formatPercent(s.success_rate)}</span>
        </div>
      </div>

      <section className="rep-card" aria-labelledby="rep-activity-h">
        <div className="rep-card-head">
          <h3 id="rep-activity-h" className="rep-card-title">
            {t("reports.chart.title")}
          </h3>
          <div className="rep-legend">
            <span>
              <i className="rep-dot rep-dot--bar" aria-hidden="true" />
              {t("reports.kpi.requests")}
            </span>
            <span>
              <i className="rep-dot rep-dot--line" aria-hidden="true" />
              {t("reports.kpi.tokens")}
            </span>
          </div>
        </div>
        {seriesState.loading ? (
          <RepLoading />
        ) : series.length === 0 ? (
          <p className="rep-muted">{t("reports.state.empty")}</p>
        ) : (
          <MiniChart
            points={series}
            firstLabel={formatBucketLabel(series[0].bucket, bucket)}
            lastLabel={formatBucketLabel(series[series.length - 1].bucket, bucket)}
          />
        )}
      </section>

      <div className="rep-splits">
        <section className="rep-card" aria-labelledby="rep-mode-h">
          <h3 id="rep-mode-h" className="rep-card-title">
            {t("reports.split.mode")}
          </h3>
          <SplitBar
            a={s.by_mode.single ?? 0}
            b={s.by_mode.compare ?? 0}
            aLabel={t("reports.mode.single")}
            bLabel={t("reports.mode.compare")}
          />
        </section>
        <section className="rep-card" aria-labelledby="rep-bill-h">
          <h3 id="rep-bill-h" className="rep-card-title">
            {t("reports.split.billing")}
          </h3>
          <SplitBar
            a={s.billable_vs_own.billable ?? 0}
            b={s.billable_vs_own.own_key ?? 0}
            aLabel={t("reports.billing.billable")}
            bLabel={t("reports.billing.ownKey")}
          />
        </section>
      </div>
    </div>
  );
}
