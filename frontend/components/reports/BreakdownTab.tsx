// frontend/components/reports/BreakdownTab.tsx
//
// Usage Reports — Breakdown (PH28): an accordion drill-down
// `access key → model → chats`, with requests + tokens at every level. The
// access-key level answers the quota question first (app keys vs own keys),
// then models, then the chats inside each model. Chat leaves open the chat.

"use client";

import { useState } from "react";

import { IconChevronRight } from "@/components/icons/Icons";
import { RepEmpty, RepError, RepLoading } from "@/components/reports/RepState";
import { formatInt, modelLabel, useReportData } from "@/components/reports/reportUtils";
import { getBreakdown, type ReportRange } from "@/services/reportsApi";
import { useChatMode } from "@/store/ChatModeContext";
import { useChats } from "@/store/ChatsContext";
import { useI18n } from "@/store/LanguageContext";
import { useReports } from "@/store/ReportsContext";
import type { BreakdownChat } from "@/types/api";

interface BreakdownTabProps {
  range: ReportRange;
  readOnly: boolean;
}

export default function BreakdownTab({ range, readOnly }: BreakdownTabProps) {
  const { t } = useI18n();
  const { setMode } = useChatMode();
  const { selectChat } = useChats();
  const { close } = useReports();
  const { data, loading, error } = useReportData(() => getBreakdown(range));

  // Access groups expanded by default; models collapsed (drill down on demand).
  const [open, setOpen] = useState<Set<string>>(() => new Set(["acc:app", "acc:own"]));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) return <RepLoading />;
  if (error || !data) return <RepError />;
  if (data.groups.length === 0) return <RepEmpty />;

  function openChat(chat: BreakdownChat) {
    if (readOnly || chat.chat_id === null) return;
    if (chat.mode) setMode(chat.mode);
    void selectChat(chat.chat_id);
    close();
  }

  return (
    <div className="rep-tree">
      {data.groups.map((group) => {
        const accId = `acc:${group.access_key}`;
        const accOpen = open.has(accId);
        const accLabel =
          group.access_key === "app" ? t("reports.access.app") : t("reports.access.own");
        return (
          <div className="rep-acc rep-acc--lvl0" key={accId}>
            <button
              type="button"
              className="rep-acc-head"
              aria-expanded={accOpen}
              aria-controls={`${accId}-panel`}
              onClick={() => toggle(accId)}
            >
              <IconChevronRight
                size={15}
                className={accOpen ? "rep-acc-ic is-open" : "rep-acc-ic"}
              />
              <span className="rep-acc-title">{accLabel}</span>
              <span className="rep-acc-stat">
                {formatInt(group.requests)} · {formatInt(group.total_tokens)}
              </span>
            </button>
            {accOpen && (
              <div className="rep-acc-panel" id={`${accId}-panel`}>
                {group.models.map((model) => {
                  const modId = `mod:${group.access_key}:${model.model ?? "—"}`;
                  const modOpen = open.has(modId);
                  return (
                    <div className="rep-acc rep-acc--lvl1" key={modId}>
                      <button
                        type="button"
                        className="rep-acc-head"
                        aria-expanded={modOpen}
                        aria-controls={`${modId}-panel`}
                        onClick={() => toggle(modId)}
                      >
                        <IconChevronRight
                          size={14}
                          className={modOpen ? "rep-acc-ic is-open" : "rep-acc-ic"}
                        />
                        <span className="rep-acc-title">{modelLabel(model.model)}</span>
                        <span className="rep-acc-stat">
                          {formatInt(model.requests)} · {formatInt(model.total_tokens)}
                        </span>
                      </button>
                      {modOpen && (
                        <ul className="rep-acc-panel rep-acc-chats" id={`${modId}-panel`}>
                          {model.chats.map((chat) => {
                            const deleted = chat.chat_id === null;
                            const clickable = !deleted && !readOnly;
                            return (
                              <li key={chat.chat_id ?? "—"}>
                                <div
                                  className={clickable ? "rep-leaf rep-leaf--click" : "rep-leaf"}
                                  role={clickable ? "button" : undefined}
                                  tabIndex={clickable ? 0 : undefined}
                                  onClick={clickable ? () => openChat(chat) : undefined}
                                  onKeyDown={
                                    clickable
                                      ? (e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            openChat(chat);
                                          }
                                        }
                                      : undefined
                                  }
                                >
                                  <span className="rep-leaf-title">
                                    {deleted ? t("reports.chat.deleted") : chat.title}
                                  </span>
                                  <span className="rep-acc-stat">
                                    {formatInt(chat.requests)} · {formatInt(chat.total_tokens)}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <p className="rep-tree-legend">{t("reports.breakdown.legend")}</p>
    </div>
  );
}
