// frontend/components/reports/MiniChart.tsx
//
// Lightweight inline-SVG chart for the Usage Reports dashboard (PH27, E2) — no
// heavy charting dependency (D-18/p.7). Renders requests as bars and tokens as
// an overlaid line, each normalized to its own max, on design tokens. Provides a
// text alternative (aria-label) and is purely presentational.

"use client";

import { useI18n } from "@/store/LanguageContext";
import type { TimeseriesPoint } from "@/types/api";

interface MiniChartProps {
  points: TimeseriesPoint[];
  // Localized labels for the first/last bucket (caller formats the dates).
  firstLabel: string;
  lastLabel: string;
}

const W = 600;
const H = 150;
const PAD_X = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 18;

export default function MiniChart({ points, firstLabel, lastLabel }: MiniChartProps) {
  const { t } = useI18n();

  if (points.length === 0) return null;

  const maxReq = Math.max(1, ...points.map((p) => p.requests));
  const maxTok = Math.max(1, ...points.map((p) => p.tokens));
  const totalReq = points.reduce((sum, p) => sum + p.requests, 0);
  const totalTok = points.reduce((sum, p) => sum + p.tokens, 0);

  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const n = points.length;
  const slot = chartW / n;
  const barW = Math.max(2, Math.min(slot * 0.6, 26));

  const yReq = (v: number) => PAD_TOP + chartH - (v / maxReq) * chartH;
  const yTok = (v: number) => PAD_TOP + chartH - (v / maxTok) * chartH;
  const cx = (i: number) => PAD_X + slot * i + slot / 2;

  const linePoints = points.map((p, i) => `${cx(i)},${yTok(p.tokens)}`).join(" ");

  const ariaLabel = t("reports.chart.aria", {
    requests: totalReq,
    tokens: totalTok,
    buckets: n,
  });

  return (
    <figure className="rep-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rep-chart-svg"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        {/* Baseline */}
        <line
          x1={PAD_X}
          y1={PAD_TOP + chartH}
          x2={W - PAD_X}
          y2={PAD_TOP + chartH}
          className="rep-chart-axis"
        />
        {/* Requests bars */}
        {points.map((p, i) => {
          const h = (p.requests / maxReq) * chartH;
          return (
            <rect
              key={`b${i}`}
              x={cx(i) - barW / 2}
              y={PAD_TOP + chartH - h}
              width={barW}
              height={h}
              rx={2}
              className="rep-chart-bar"
            />
          );
        })}
        {/* Tokens line */}
        {n > 1 && <polyline points={linePoints} className="rep-chart-line" fill="none" />}
        {points.map((p, i) => (
          <circle key={`d${i}`} cx={cx(i)} cy={yTok(p.tokens)} r={2.2} className="rep-chart-dot" />
        ))}
      </svg>
      <figcaption className="rep-chart-axislabels" aria-hidden="true">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </figcaption>
    </figure>
  );
}
