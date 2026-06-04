// frontend/store/useChatNav.tsx
//
// Shared chat-navigation data + handlers (PH37/M1). Extracted from Sidebar so the
// desktop sidebar accordions and the mobile MobileModeBar dropdowns drive the
// EXACT same New Chat / history / rename / delete / mode-switch flow without
// duplicating logic (frontend golden rule: no duplication).
//
// What stays out of here: the accordion open/collapsed UI state and the mobile
// drawer focus-trap — those belong to the components that own them. This hook is
// purely the data + actions both consumers share.

"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useChatMode, type ChatMode } from "@/store/ChatModeContext";
import { useChats } from "@/store/ChatsContext";
import { useComposer } from "@/store/ComposerContext";
import { useI18n } from "@/store/LanguageContext";
import type { ChatSummary } from "@/types/api";

// Refresh relative timestamps roughly every 30s without re-rendering on every
// frame; cheap and keeps "N min ago" honest.
const TICK_MS = 30_000;

export interface ChatNav {
  mode: ChatMode;
  singleChats: ChatSummary[];
  compareChats: ChatSummary[];
  // Raw active chat id (for effects that watch navigation), plus the per-mode
  // values the accordions actually highlight with.
  activeChatId: number | null;
  singleActiveId: number | null;
  compareActiveId: number | null;
  loading: boolean;
  error: string | null;
  nowMs: number;
  // Limit notice, already rendered and scoped to the active mode's section.
  singleNotice: ReactNode;
  compareNotice: ReactNode;
  newSingle: () => void;
  newCompare: () => void;
  pickSingle: (chat: ChatSummary) => void;
  pickCompare: (chat: ChatSummary) => void;
  rename: (id: number, title: string) => void;
  remove: (id: number) => void;
}

export function useChatNav(): ChatNav {
  const { t } = useI18n();
  const { mode, setMode } = useChatMode();
  const {
    singleChats,
    compareChats,
    activeChatId,
    selectChat,
    newChat,
    loading,
    error,
    rename,
    remove,
    notice,
  } = useChats();
  const { openSingle } = useComposer();

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  function newSingle() {
    setMode("single");
    void newChat(); // clears active chat → draft
    openSingle(null); // → model picker
  }

  function newCompare() {
    setMode("compare");
    void newChat();
  }

  function pickSingle(chat: ChatSummary) {
    setMode("single");
    void selectChat(chat.id);
    openSingle(chat.model); // bind composer to this chat's fixed model
  }

  function pickCompare(chat: ChatSummary) {
    setMode("compare");
    void selectChat(chat.id);
  }

  const limitNotice = notice ? (
    <div className="cc-newchat-notice" role="status">
      {t(notice, { limit: 25 })}
    </div>
  ) : null;

  return {
    mode,
    singleChats,
    compareChats,
    activeChatId,
    singleActiveId: mode === "single" ? activeChatId : null,
    compareActiveId: mode === "compare" ? activeChatId : null,
    loading,
    error,
    nowMs,
    singleNotice: mode === "single" ? limitNotice : null,
    compareNotice: mode === "compare" ? limitNotice : null,
    newSingle,
    newCompare,
    pickSingle,
    pickCompare,
    rename,
    remove,
  };
}
