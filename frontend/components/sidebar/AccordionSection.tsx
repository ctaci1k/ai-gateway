// frontend/components/sidebar/AccordionSection.tsx
//
// One collapsible sidebar group (PH24, A3 / C2): a head (icon + label + sub +
// chevron), a "+ New Chat" button, and a nested, collapsible History list of
// saved chats for this mode. History rows show the title + relative time, the
// active chat is highlighted, and each row can be renamed / deleted inline.

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  IconChevron,
  IconChevronRight,
  IconClose,
  IconEdit,
  IconHistory,
  IconPlus,
} from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { formatRelativeTime } from "@/utils/relativeTime";
import type { ChatSummary } from "@/types/api";

interface HistoryRowProps {
  chat: ChatSummary;
  active: boolean;
  nowMs: number;
  onPick: () => void;
  onRename: (title: string) => void;
  onRemove: () => void;
}

function HistoryRow({ chat, active, nowMs, onPick, onRename, onRemove }: HistoryRowProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== chat.title) onRename(next);
  }

  const rel = formatRelativeTime(chat.updated_at, nowMs, {
    justNow: t("time.justNow"),
    minutes: t("time.minutes"),
    hours: t("time.hours"),
    days: t("time.days"),
  });

  if (editing) {
    return (
      <div className={active ? "cc-hrow is-active" : "cc-hrow"}>
        <input
          ref={inputRef}
          className="cc-hrow-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label={t("chat.titleLabel")}
          maxLength={255}
        />
      </div>
    );
  }

  return (
    <div className={active ? "cc-hrow is-active" : "cc-hrow"}>
      <button
        type="button"
        className="cc-hrow-open"
        onClick={onPick}
        aria-current={active ? "true" : undefined}
        title={chat.title}
      >
        <span className="dotm" aria-hidden="true" />
        <span className="htx">{chat.title}</span>
        <span className="htime">{rel}</span>
      </button>
      <div className="cc-hrow-actions">
        <button
          type="button"
          className="cc-hrow-act"
          onClick={() => {
            setDraft(chat.title);
            setEditing(true);
          }}
          aria-label={t("chat.rename")}
          title={t("chat.rename")}
        >
          <IconEdit size={12} />
        </button>
        <button
          type="button"
          className="cc-hrow-act"
          onClick={() => {
            if (window.confirm(t("chat.deleteConfirm"))) onRemove();
          }}
          aria-label={t("chat.delete")}
          title={t("chat.delete")}
        >
          <IconClose size={12} />
        </button>
      </div>
    </div>
  );
}

interface AccordionSectionProps {
  icon: ReactNode;
  label: string;
  sub: string;
  open: boolean;
  onToggle: () => void;
  newChatLabel: string;
  onNewChat: () => void;
  chats: ChatSummary[];
  activeChatId: number | null;
  loading: boolean;
  error: string | null;
  histOpen: boolean;
  onHistToggle: () => void;
  nowMs: number;
  notice: ReactNode;
  onPickChat: (chat: ChatSummary) => void;
  onRename: (id: number, title: string) => void;
  onRemove: (id: number) => void;
  // Headless mode (PH37/M2): used inside the mobile MobileModeBar popover, where
  // the dropdown trigger already names the section. Skips the head row and always
  // renders the body (ignores `open`/`onToggle`). Default false → desktop sidebar
  // is unchanged.
  headless?: boolean;
}

export default function AccordionSection({
  icon,
  label,
  sub,
  open,
  onToggle,
  newChatLabel,
  onNewChat,
  chats,
  activeChatId,
  loading,
  error,
  histOpen,
  onHistToggle,
  nowMs,
  notice,
  onPickChat,
  onRename,
  onRemove,
  headless = false,
}: AccordionSectionProps) {
  const { t } = useI18n();
  const bodyOpen = headless || open;

  return (
    <div
      className={["cc-acc", headless ? "cc-acc--headless" : "", bodyOpen ? "is-open" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {!headless && (
        <button type="button" className="cc-acc-head" onClick={onToggle} aria-expanded={open}>
          <span className="ic">{icon}</span>
          <span className="lab">
            {label}
            <small>{sub}</small>
          </span>
          <IconChevron size={16} className="chev" />
        </button>
      )}

      {bodyOpen && (
        <div className="cc-acc-body">
          {/* PH39/M2: in the headless mobile popover the compact topbar trigger
              ellipsises to "Sin…"/"Com…" and the skipped head row hides the name
              entirely, so the full mode name lives here, above "+ New Chat". The
              desktop sidebar keeps its own cc-acc-head and never sees this. */}
          {headless && (
            <div className="cc-mmpop-head">
              <span>{label}</span>
              {sub && <small>{sub}</small>}
            </div>
          )}
          <button type="button" className="cc-newchat" onClick={onNewChat}>
            <IconPlus size={15} />
            {newChatLabel}
          </button>
          {notice}

          <div className={histOpen ? "cc-sub is-open" : "cc-sub"}>
            <button
              type="button"
              className="cc-sub-head"
              onClick={onHistToggle}
              aria-expanded={histOpen}
            >
              <IconHistory size={14} />
              {t("history.title")}
              <IconChevronRight size={13} className="chev" />
            </button>

            {histOpen && (
              <div className="cc-sub-body">
                {error ? (
                  <div className="cc-hist-note">{error}</div>
                ) : loading && chats.length === 0 ? (
                  <div className="cc-hist-note">{t("chatList.loading")}</div>
                ) : chats.length === 0 ? (
                  <div className="cc-hist-note">{t("chatList.empty")}</div>
                ) : (
                  chats.map((chat) => (
                    <HistoryRow
                      key={chat.id}
                      chat={chat}
                      active={chat.id === activeChatId}
                      nowMs={nowMs}
                      onPick={() => onPickChat(chat)}
                      onRename={(title) => onRename(chat.id, title)}
                      onRemove={() => onRemove(chat.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
