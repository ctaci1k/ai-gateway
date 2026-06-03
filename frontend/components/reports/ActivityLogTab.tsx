// frontend/components/reports/ActivityLogTab.tsx
//
// Usage Reports — Activity log (PH27, E5): a keyset-paginated event log (time,
// mode, model, chat, message snippet, tokens, status, billable badge) with a
// "load more" button and a CSV export of the current period.

"use client";

import { useEffect, useState } from "react";

import { IconDownload } from "@/components/icons/Icons";
import KeyBadge from "@/components/reports/KeyBadge";
import { RepEmpty, RepError, RepLoading } from "@/components/reports/RepState";
import { formatDateTime, formatTokens, reportModel } from "@/components/reports/reportUtils";
import { eventsCsvUrl, getEvents, type ReportRange } from "@/services/reportsApi";
import { useI18n } from "@/store/LanguageContext";
import type { ReportEvent } from "@/types/api";

interface ActivityLogTabProps {
  range: ReportRange;
}

const PAGE = 50;

export default function ActivityLogTab({ range }: ActivityLogTabProps) {
  const { t } = useI18n();
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // Mount-once first page (the parent remounts this tab via key=rangeKey when the
  // window changes). State is set only inside async callbacks, never
  // synchronously in the effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    getEvents(range, null, PAGE)
      .then((page) => {
        if (cancelled) return;
        setEvents(page.events);
        setCursor(page.next_cursor);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getEvents(range, cursor, PAGE);
      setEvents((prev) => [...prev, ...page.events]);
      setCursor(page.next_cursor);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) return <RepLoading />;
  if (error && events.length === 0) return <RepError />;

  return (
    <div className="rep-log">
      <div className="rep-log-bar">
        <a
          className="rep-csv-btn"
          href={eventsCsvUrl(range)}
          download="usage-report.csv"
          rel="noopener"
        >
          <IconDownload size={15} />
          {t("reports.exportCsv")}
        </a>
      </div>

      {events.length === 0 ? (
        <RepEmpty />
      ) : (
        <div className="rep-table-wrap thin-scroll">
          <table className="rep-table">
            <thead>
              <tr>
                <th scope="col">{t("reports.col.time")}</th>
                <th scope="col">{t("reports.col.mode")}</th>
                <th scope="col">{t("reports.col.model")}</th>
                <th scope="col">{t("reports.col.key")}</th>
                <th scope="col">{t("reports.col.chat")}</th>
                <th scope="col">{t("reports.col.message")}</th>
                <th scope="col" className="rep-num">
                  {t("reports.col.tokens")}
                </th>
                <th scope="col">{t("reports.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="rep-row">
                  <td className="rep-nowrap">{formatDateTime(e.created_at)}</td>
                  <td>{t(`reports.mode.${e.mode}`)}</td>
                  <td>{reportModel(e)}</td>
                  <td>
                    <KeyBadge fingerprint={e.key_fingerprint} />
                  </td>
                  <td className="rep-cell-clip">{e.chat_title ?? t("reports.chat.adhoc")}</td>
                  <td className="rep-cell-msg">{e.message}</td>
                  <td className="rep-num">
                    {e.total_tokens === null
                      ? "—"
                      : formatTokens(e.total_tokens, e.token_estimated)}
                  </td>
                  <td>
                    <span className="rep-tags">
                      <span
                        className={
                          e.success ? "rep-badge rep-badge--ok" : "rep-badge rep-badge--fail"
                        }
                      >
                        {e.success ? t("reports.status.ok") : t("reports.status.fail")}
                      </span>
                      {!e.billable && (
                        <span className="rep-badge rep-badge--own">
                          {t("reports.billing.ownKey")}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cursor && (
        <div className="rep-log-more">
          <button
            type="button"
            className="rep-more-btn"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? t("reports.state.loading") : t("reports.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
