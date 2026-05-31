// frontend/components/sidebar/ChatList.tsx

"use client";

import { useEffect, useRef, useState } from "react";

import { IconChat, IconClose, IconEdit } from "@/components/icons/Icons";
import { useChats } from "@/store/ChatsContext";
import { useI18n } from "@/store/LanguageContext";
import type { ChatSummary } from "@/types/api";

function ChatRow({ chat }: { chat: ChatSummary }) {
  const { t } = useI18n();
  const { activeChatId, selectChat, rename, remove } = useChats();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = chat.id === activeChatId;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(chat.title);
    setEditing(true);
  }

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== chat.title) {
      void rename(chat.id, next);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") setEditing(false);
  }

  function onDelete() {
    if (window.confirm(t("chat.deleteConfirm"))) {
      void remove(chat.id);
    }
  }

  if (editing) {
    return (
      <div className={`chat-row ${active ? "chat-row--active" : ""}`}>
        <input
          ref={inputRef}
          className="chat-row-edit"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          aria-label={t("chat.titleLabel")}
          maxLength={255}
        />
      </div>
    );
  }

  return (
    <div className={`chat-row ${active ? "chat-row--active" : ""}`}>
      <button
        type="button"
        className="chat-row-open"
        onClick={() => void selectChat(chat.id)}
        aria-current={active ? "true" : undefined}
        aria-label={t("chatList.open")}
        title={chat.title}
      >
        <IconChat size={15} />
        <span className="chat-row-title">{chat.title}</span>
      </button>
      <div className="chat-row-actions">
        <button
          type="button"
          className="chat-row-act"
          onClick={startEdit}
          aria-label={t("chat.rename")}
          title={t("chat.rename")}
        >
          <IconEdit size={13} />
        </button>
        <button
          type="button"
          className="chat-row-act"
          onClick={onDelete}
          aria-label={t("chat.delete")}
          title={t("chat.delete")}
        >
          <IconClose size={13} />
        </button>
      </div>
    </div>
  );
}

export default function ChatList() {
  const { t } = useI18n();
  const { chats, loading, error } = useChats();

  return (
    <>
      <div className="sb-cap">{t("chatList.compareSection")}</div>

      {error ? (
        <div className="syslog-row">
          <span className="muted2">{error}</span>
        </div>
      ) : loading && chats.length === 0 ? (
        <div className="syslog-row">
          <span className="muted2">{t("chatList.loading")}</span>
        </div>
      ) : chats.length === 0 ? (
        <div className="syslog-row">
          <span className="muted2">{t("chatList.empty")}</span>
        </div>
      ) : (
        <div className="chat-rows">
          {chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} />
          ))}
        </div>
      )}
    </>
  );
}
