// frontend/components/reports/ByModelTab.tsx
//
// Usage Reports — By models (PH27, E3): per-model table (requests, tokens,
// success %) with an inline token-share bar. Truthful model labels.

"use client";

import KeyBadge from "@/components/reports/KeyBadge";
import { RepEmpty, RepError, RepLoading } from "@/components/reports/RepState";
import { formatInt, reportModel, useReportData } from "@/components/reports/reportUtils";
import { getByModel, type ReportRange } from "@/services/reportsApi";
import { useI18n } from "@/store/LanguageContext";

interface ByModelTabProps {
  range: ReportRange;
}

export default function ByModelTab({ range }: ByModelTabProps) {
  const { t } = useI18n();
  const { data, loading, error } = useReportData(() => getByModel(range));

  if (loading) return <RepLoading />;
  if (error || !data) return <RepError />;
  if (data.length === 0) return <RepEmpty />;

  const maxTokens = Math.max(1, ...data.map((m) => m.total_tokens));

  return (
    <div className="rep-table-wrap thin-scroll">
      <table className="rep-table">
        <thead>
          <tr>
            <th scope="col">{t("reports.col.model")}</th>
            <th scope="col">{t("reports.col.key")}</th>
            <th scope="col" className="rep-num">
              {t("reports.col.requests")}
            </th>
            <th scope="col" className="rep-num">
              {t("reports.col.tokens")}
            </th>
            <th scope="col" className="rep-num">
              {t("reports.col.success")}
            </th>
            <th scope="col" className="rep-share-col">
              {t("reports.col.tokenShare")}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => {
            const successPct = m.requests > 0 ? Math.round((m.successful / m.requests) * 100) : 0;
            const share = (m.total_tokens / maxTokens) * 100;
            return (
              <tr
                key={`${m.model ?? "unknown"}|${m.key_fingerprint ?? "builtin"}|${m.role}|${m.model_name ?? ""}`}
              >
                <th scope="row" className="rep-cell-strong">
                  {reportModel(m)}
                  {m.role === "judge" && (
                    <span className="rep-roletag">{t("reports.judgeTag")}</span>
                  )}
                </th>
                <td>
                  <KeyBadge fingerprint={m.key_fingerprint} />
                </td>
                <td className="rep-num">{formatInt(m.requests)}</td>
                <td className="rep-num">{formatInt(m.total_tokens)}</td>
                <td className="rep-num">{successPct}%</td>
                <td className="rep-share-col">
                  <span className="rep-sharebar" aria-hidden="true">
                    <span className="rep-sharebar-fill" style={{ width: `${share}%` }} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
