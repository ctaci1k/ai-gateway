// frontend/store/ComposerContext.tsx
//
// Single-mode streaming controller (PH13 → PH24/D-17). Owns:
//   - singleProvider: the model the current Single chat is bound to. `null`
//     means "no model chosen yet" → the model picker is shown (a new chat).
//   - the in-flight turn (pending user message + streaming assistant text +
//     sources + loading + error). The PERSISTED thread lives in the saved chat
//     (ChatsContext.activeChat), mirroring Compare — Single chats are now
//     first-class saved chats (D-17, rewriting D-3's ephemeral Single).
//
// sendMessage creates the saved chat on the first message (titled after it,
// bound to singleProvider), streams the answer, persists the turn server-side
// (chat_id) and reloads the saved thread. RAG is applied automatically whenever
// the user has uploaded documents.

"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { streamChat } from "@/services/chatApi";
import { useChats } from "@/store/ChatsContext";
import { useKeys } from "@/store/KeysContext";
import { useRagDocuments } from "@/store/RagContext";
import { deriveChatTitle } from "@/utils/chatTitle";
import type { FailureReason, RagSource, StreamEvent } from "@/types/api";

// A composer error is rendered in the component layer, so it carries either a
// translation key (preferred) or a raw backend message. Texts stay out of the
// store (golden rule).
export interface ComposerError {
  messageKey?: string;
  message?: string;
}

// Carries the classified reason from a mid-stream `error` event so the catch
// handler can localize a BYOK own-key rate-limit (PH18/8, D-13).
class StreamError extends Error {
  reason: FailureReason | null;
  constructor(message: string, reason: FailureReason | null) {
    super(message);
    this.name = "StreamError";
    this.reason = reason;
  }
}

// Built-in responder models available for Single (mirrors the backend roster).
export const SINGLE_PROVIDERS = ["groq", "cerebras", "sambanova"] as const;
// A Single selection can also be a BYOK custom slot or the judge slot (NQ6).
export type SingleProvider = string;

interface ComposerValue {
  // The model the current/draft Single chat is bound to; null → pick a model.
  singleProvider: SingleProvider | null;
  // Choose a model (picker / opening a saved chat) and reset the in-flight turn.
  openSingle: (provider: SingleProvider | null) => void;
  loading: boolean;
  streamingMessage: string;
  // The user's message for the in-flight turn (optimistic), null when idle.
  pendingUserMessage: string | null;
  sources: RagSource[];
  error: ComposerError | null;
  sendMessage: (message: string) => Promise<void>;
}

const ComposerContext = createContext<ComposerValue | null>(null);

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [singleProvider, setSingleProvider] = useState<SingleProvider | null>(null);

  // RAG is applied automatically whenever the user has any documents.
  const { documents } = useRagDocuments();
  const ragEnabled = documents.length > 0;

  const { byokPayload, byokModelId } = useKeys();
  const { activeChatId, createActiveChat, reloadActive } = useChats();

  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [sources, setSources] = useState<RagSource[]>([]);
  const [error, setError] = useState<ComposerError | null>(null);

  // Switch the active Single model (or null → picker) and drop any in-flight
  // turn. Used by the picker, opening a saved chat, and starting a new chat.
  const openSingle = useCallback((provider: SingleProvider | null) => {
    setSingleProvider(provider);
    setStreamingMessage("");
    setPendingUserMessage(null);
    setSources([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      const provider = singleProvider;
      if (!message.trim() || !provider) {
        return;
      }

      setError(null);
      setSources([]);
      setPendingUserMessage(message);
      setLoading(true);
      setStreamingMessage("");

      // First message of a draft creates the saved Single chat (titled after it,
      // bound to the chosen model). Subsequent messages append to the same chat.
      let chatId = activeChatId;
      if (chatId === null) {
        chatId = await createActiveChat(deriveChatTitle(message), "single", provider);
        if (chatId === null) {
          // Limit reached / error — the notice is shown by ChatsContext.
          setLoading(false);
          setPendingUserMessage(null);
          return;
        }
      }

      try {
        const res = await streamChat({
          message,
          provider,
          ragEnabled,
          byok: byokPayload(),
          chatId,
        });
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("No response stream");
        }

        const decoder = new TextDecoder();
        let fullResponse = "";
        let buffer = "";
        let streamSources: RagSource[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value);
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(line) as StreamEvent;
            } catch {
              continue; // ignore malformed NDJSON lines
            }
            if (event.type === "token") {
              fullResponse += event.content;
              setStreamingMessage(fullResponse);
            } else if (event.type === "sources") {
              streamSources = event.sources;
            } else if (event.type === "error") {
              throw new StreamError(event.content, event.reason ?? null);
            }
          }
        }

        setSources(streamSources);
        // The turn is persisted server-side; reload the saved thread, then drop
        // the optimistic in-flight turn (now rendered from the saved chat).
        await reloadActive(chatId);
        setPendingUserMessage(null);
        setStreamingMessage("");
      } catch (err) {
        const ownKeyRateLimited =
          err instanceof StreamError &&
          err.reason === "rate_limited" &&
          byokModelId(provider) !== null;
        if (ownKeyRateLimited) {
          setError({ messageKey: "errors.ownKeyRateLimited" });
        } else {
          setError({ message: err instanceof Error ? err.message : undefined });
        }
        setStreamingMessage("");
        setPendingUserMessage(null);
      } finally {
        setLoading(false);
      }
    },
    [
      singleProvider,
      ragEnabled,
      byokPayload,
      byokModelId,
      activeChatId,
      createActiveChat,
      reloadActive,
    ],
  );

  const value = useMemo<ComposerValue>(
    () => ({
      singleProvider,
      openSingle,
      loading,
      streamingMessage,
      pendingUserMessage,
      sources,
      error,
      sendMessage,
    }),
    [
      singleProvider,
      openSingle,
      loading,
      streamingMessage,
      pendingUserMessage,
      sources,
      error,
      sendMessage,
    ],
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useComposer(): ComposerValue {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error("useComposer must be used inside ComposerProvider");
  }
  return context;
}
