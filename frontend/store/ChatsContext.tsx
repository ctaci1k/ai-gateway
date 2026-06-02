// frontend/store/ChatsContext.tsx
//
// Saved chats state (PH9 / PH24). Holds the chat list, the active chat (with its
// persisted turns), and CRUD actions. PH24 (D-17): chats are mode-aware — Single
// chats are now first-class saved chats alongside Compare. The list keeps all of
// the user's chats; `singleChats` / `compareChats` are derived per mode. The
// saved-chat limit (SAVED_CHATS_LIMIT) is shared across both modes.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createChat, deleteChat, getChat, listChats, renameChat } from "@/services/chatsApi";
import { useAuth } from "@/store/AuthContext";
import type { ChatDetail, ChatMode, ChatSummary } from "@/types/api";

// Mirrors the backend SAVED_CHATS_LIMIT (OD-3: 25), shared across Single +
// Compare; creation is also guarded server-side (409).
export const SAVED_CHATS_LIMIT = 25;

interface ChatsValue {
  chats: ChatSummary[];
  singleChats: ChatSummary[];
  compareChats: ChatSummary[];
  activeChatId: number | null;
  activeChat: ChatDetail | null;
  loading: boolean;
  error: string | null;
  limitReached: boolean;
  // Transient i18n key for a user-facing notice (e.g. the limit was reached).
  notice: string | null;
  clearNotice: () => void;
  refresh: () => Promise<void>;
  selectChat: (id: number | null) => Promise<void>;
  // Enter an empty local draft (no server persist until the first message).
  newChat: () => Promise<void>;
  // Persist a chat titled after the first message; returns its id (or null when
  // blocked by the limit / an error). Used by both modes on first send.
  createActiveChat: (
    title: string,
    mode?: ChatMode,
    model?: string | null,
  ) => Promise<number | null>;
  rename: (id: number, title: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  // Re-fetch a chat (defaults to the active one) plus the list after a turn.
  reloadActive: (id?: number) => Promise<void>;
}

const ChatsContext = createContext<ChatsValue | null>(null);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearNotice = useCallback(() => setNotice(null), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setChats(await listChats());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load chats once authenticated; reset everything on sign-out.
  useEffect(() => {
    let active = true;
    if (status === "authenticated") {
      listChats()
        .then((data) => {
          if (active) setChats(data);
        })
        .catch((err) => {
          if (active) setError(errorMessage(err));
        });
    } else if (status === "anonymous") {
      Promise.resolve().then(() => {
        if (!active) return;
        setChats([]);
        setActiveChatId(null);
        setActiveChat(null);
      });
    }
    return () => {
      active = false;
    };
  }, [status]);

  const selectChat = useCallback(async (id: number | null) => {
    setNotice(null);
    if (id === null) {
      setActiveChatId(null);
      setActiveChat(null);
      return;
    }
    setError(null);
    setActiveChatId(id);
    try {
      setActiveChat(await getChat(id));
    } catch (err) {
      setError(errorMessage(err));
      setActiveChatId(null);
      setActiveChat(null);
    }
  }, []);

  // "New chat" opens an empty local draft — nothing is persisted until the first
  // message (createActiveChat). When the shared limit is reached we surface the
  // notice instead of starting a draft.
  const newChat = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (chats.length >= SAVED_CHATS_LIMIT) {
      setNotice("chatList.limitReached");
      return;
    }
    setActiveChatId(null);
    setActiveChat(null);
  }, [chats]);

  // On the first message, persist a chat titled after it. The id is returned so
  // the caller can run the turn against it without waiting for state to settle.
  const createActiveChat = useCallback(
    async (
      title: string,
      mode: ChatMode = "compare",
      model: string | null = null,
    ): Promise<number | null> => {
      setError(null);
      setNotice(null);
      if (chats.length >= SAVED_CHATS_LIMIT) {
        setNotice("chatList.limitReached");
        return null;
      }
      try {
        const chat = await createChat({ title, mode, model });
        setChats((prev) => [chat, ...prev]);
        setActiveChatId(chat.id);
        setActiveChat(chat);
        return chat.id;
      } catch (err) {
        setError(errorMessage(err));
        return null;
      }
    },
    [chats],
  );

  const rename = useCallback(async (id: number, title: string) => {
    setError(null);
    try {
      const updated = await renameChat(id, title);
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c)));
      setActiveChat((prev) => (prev && prev.id === id ? { ...prev, title: updated.title } : prev));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    setError(null);
    try {
      await deleteChat(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      setActiveChatId((prev) => (prev === id ? null : prev));
      setActiveChat((prev) => (prev && prev.id === id ? null : prev));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  // Re-fetch a chat (after a turn is persisted) and refresh the list so title /
  // ordering stay accurate. Defaults to the active chat, but accepts an explicit
  // id for a just-created chat whose state hasn't propagated yet.
  const reloadActive = useCallback(
    async (id?: number) => {
      const target = id ?? activeChatId;
      if (target === null) return;
      try {
        setActiveChat(await getChat(target));
        setChats(await listChats());
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [activeChatId],
  );

  const singleChats = useMemo(() => chats.filter((c) => c.mode === "single"), [chats]);
  const compareChats = useMemo(() => chats.filter((c) => c.mode === "compare"), [chats]);

  const value = useMemo<ChatsValue>(
    () => ({
      chats,
      singleChats,
      compareChats,
      activeChatId,
      activeChat,
      loading,
      error,
      limitReached: chats.length >= SAVED_CHATS_LIMIT,
      notice,
      clearNotice,
      refresh,
      selectChat,
      newChat,
      createActiveChat,
      rename,
      remove,
      reloadActive,
    }),
    [
      chats,
      singleChats,
      compareChats,
      activeChatId,
      activeChat,
      loading,
      error,
      notice,
      clearNotice,
      refresh,
      selectChat,
      newChat,
      createActiveChat,
      rename,
      remove,
      reloadActive,
    ],
  );

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>;
}

export function useChats(): ChatsValue {
  const context = useContext(ChatsContext);
  if (!context) {
    throw new Error("useChats must be used inside ChatsProvider");
  }
  return context;
}
