// frontend/components/reports/ByChatTab.tsx
//
// Usage Reports — By chats (PH27, E4): per-chat table (title, mode, model,
// requests, tokens, last activity). A row opens that chat (switches mode +
// selects it) and closes the modal. Events whose chat was deleted collapse into
// a non-clickable "deleted / ad-hoc" row.

"use client";

import { RepEmpty, RepError, RepLoading } from "@/components/reports/RepState";
import { formatInt, modelLabel, useReportData } from "@/components/reports/reportUtils";
import { getByChat, type ReportRange } from "@/services/reportsApi";
import { useChatMode } from "@/store/ChatModeContext";
import { useChats } from "@/store/ChatsContext";
import { useI18n } from "@/store/LanguageContext";
import { useReports } from "@/store/ReportsContext";
import type { ChatUsage } from "@/types/api";
import { formatRelativeTime } from "@/utils/relativeTime";

interface ByChatTabProps {
  range: ReportRange;
  nowMs: number;
  // Reports opened for another user (admin bonus) can't open the viewer's chats.
  readOnly: boolean;
}

export default function ByChatTab({ range, nowMs, readOnly }: ByChatTabProps) {
  const { t } = useI18n();
  const { setMode } = useChatMode();
  const { selectChat } = useChats();
  const { close } = useReports();
  const { data, loading, error } = useReportData(() => getByChat(range));

  if (loading) return <RepLoading />;
  if (error || !data) return <RepError />;
  if (data.length === 0) return <RepEmpty />;

  const relLabels = {
    justNow: t("time.justNow"),
    minutes: t("time.minutes"),
    hours: t("time.hours"),
    days: t("time.days"),
  };

  function openChat(chat: ChatUsage) {
    if (readOnly || chat.chat_id === null) return;
    if (chat.mode) setMode(chat.mode);
    void selectChat(chat.chat_id);
    close();
  }

  return (
    <div className="rep-table-wrap thin-scroll">
      <table className="rep-table">
        <thead>
          <tr>
            <th scope="col">{t("reports.col.chat")}</th>
            <th scope="col">{t("reports.col.mode")}</th>
            <th scope="col">{t("reports.col.model")}</th>
            <th scope="col" className="rep-num">
              {t("reports.col.requests")}
            </th>
            <th scope="col" className="rep-num">
              {t("reports.col.tokens")}
            </th>
            <th scope="col">{t("reports.col.lastActivity")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c) => {
            const deleted = c.chat_id === null;
            const clickable = !deleted && !readOnly;
            return (
              <tr
                key={c.chat_id ?? "deleted"}
                className={clickable ? "rep-row rep-row--click" : "rep-row"}
                onClick={clickable ? () => openChat(c) : undefined}
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? "button" : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openChat(c);
                        }
                      }
                    : undefined
                }
              >
                <th scope="row" className="rep-cell-strong">
                  {deleted ? t("reports.chat.deleted") : c.title}
                </th>
                <td>{c.mode ? t(`reports.mode.${c.mode}`) : "—"}</td>
                <td>{modelLabel(c.model)}</td>
                <td className="rep-num">{formatInt(c.requests)}</td>
                <td className="rep-num">{formatInt(c.total_tokens)}</td>
                <td>{c.last_event ? formatRelativeTime(c.last_event, nowMs, relLabels) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
