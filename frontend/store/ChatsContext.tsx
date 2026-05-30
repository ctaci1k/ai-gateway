// frontend/store/ChatsContext.tsx
//
// Saved Compare chats state (PH9): the chat list, the active chat (with its
// persisted turns), and CRUD actions. Components read/act through this context
// instead of calling services directly.

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
import type { ChatDetail, ChatSummary } from "@/types/api";

// Mirrors the backend SAVED_CHATS_LIMIT default; creation is also guarded
// server-side (409), which we surface as an error if the limits ever diverge.
export const SAVED_CHATS_LIMIT = 3;

interface ChatsValue {
  chats: ChatSummary[];
  activeChatId: number | null;
  activeChat: ChatDetail | null;
  loading: boolean;
  error: string | null;
  limitReached: boolean;
  // A3: a brand-new chat may only be created when the current active chat is
  // not still empty (0 turns). false → newChat() is blocked and sets `notice`.
  canCreate: boolean;
  // Transient i18n key for a user-facing notice (e.g. blocked creation).
  notice: string | null;
  clearNotice: () => void;
  refresh: () => Promise<void>;
  selectChat: (id: number | null) => Promise<void>;
  newChat: () => Promise<void>;
  rename: (id: number, title: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  reloadActive: () => Promise<void>;
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

  // The active chat is "empty" while it has no persisted turns yet. Creating a
  // second empty chat is pointless, so it is blocked until the current one is
  // used (A3). With no active chat, creation is allowed (subject to the limit).
  const activeIsEmpty =
    activeChat !== null && activeChat.id === activeChatId && activeChat.message_count === 0;
  const canCreate = !activeIsEmpty;

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

  // Load chats once authenticated; reset everything on sign-out. State is set
  // from async callbacks (not synchronously) to keep effects side-effect-only.
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

  const newChat = useCallback(async () => {
    setError(null);
    setNotice(null);
    // A3: block creating a second empty chat on top of an empty active one.
    if (activeChat && activeChat.id === activeChatId && activeChat.message_count === 0) {
      setNotice("chatList.currentEmpty");
      return;
    }
    if (chats.length >= SAVED_CHATS_LIMIT) {
      setNotice("chatList.limitReached");
      return;
    }
    try {
      const chat = await createChat();
      setChats((prev) => [chat, ...prev]);
      setActiveChatId(chat.id);
      setActiveChat(chat);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [activeChat, activeChatId, chats]);

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

  // Re-fetch the active chat (after a Compare turn is persisted) and refresh
  // the list so message_count / ordering stay accurate.
  const reloadActive = useCallback(async () => {
    if (activeChatId === null) return;
    try {
      setActiveChat(await getChat(activeChatId));
      setChats(await listChats());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [activeChatId]);

  const value = useMemo<ChatsValue>(
    () => ({
      chats,
      activeChatId,
      activeChat,
      loading,
      error,
      limitReached: chats.length >= SAVED_CHATS_LIMIT,
      canCreate,
      notice,
      clearNotice,
      refresh,
      selectChat,
      newChat,
      rename,
      remove,
      reloadActive,
    }),
    [
      chats,
      activeChatId,
      activeChat,
      loading,
      error,
      canCreate,
      notice,
      clearNotice,
      refresh,
      selectChat,
      newChat,
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
