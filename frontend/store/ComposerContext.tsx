// frontend/store/ComposerContext.tsx
//
// Composer-level state shared across Single and Compare (PH13/PH16):
//   - singleProvider: which responder Single streams from (B1).
//   - the Single chat thread itself (messages / streaming / sources / loading /
//     error + sendMessage / clear), lifted into the store so the topbar
//     ModelSwitcher and ChatPage share one source of truth (PH16/A1). This lets
//     a model switch confirm-and-clear a non-empty thread.
// RAG is applied automatically whenever the user has uploaded documents
// (derived from RagContext), so there is no manual toggle to store.

"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { streamChat } from "@/services/chatApi";
import { useKeys } from "@/store/KeysContext";
import { useRagDocuments } from "@/store/RagContext";
import type { FailureReason, RagSource, StreamEvent } from "@/types/api";
import type { Message } from "@/types/Message";

// A composer error is rendered in the component layer, so it carries either a
// translation key (preferred — e.g. the BYOK own-key rate-limit message) or a
// raw backend message as a fallback. Keeps texts out of the store (golden rule).
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
// A Single selection can also be a BYOK custom slot or the judge slot (NQ6),
// so the selected provider is a plain string.
export type SingleProvider = string;

interface ComposerValue {
  singleProvider: SingleProvider;
  setSingleProvider: (provider: SingleProvider) => void;
  // Single chat thread (lifted into the store, PH16/A1).
  messages: Message[];
  loading: boolean;
  streamingMessage: string;
  sources: RagSource[];
  error: ComposerError | null;
  // True while the thread has any visible content (a sent/streaming message).
  hasSingleThread: boolean;
  sendMessage: (message: string) => Promise<void>;
  clear: () => void;
}

const ComposerContext = createContext<ComposerValue | null>(null);

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [singleProvider, setSingleProvider] = useState<SingleProvider>("groq");

  // RAG is applied automatically whenever the user has any documents.
  const { documents } = useRagDocuments();
  const ragEnabled = documents.length > 0;

  // BYOK transit overrides for the request (null when no own keys are active);
  // byokModelId tells whether the chosen Single slot runs on the user's own key.
  const { byokPayload, byokModelId } = useKeys();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [sources, setSources] = useState<RagSource[]>([]);
  const [error, setError] = useState<ComposerError | null>(null);

  // B2 / A1: clear only the visual thread. Rolling history in the DB is intact.
  const clear = useCallback(() => {
    setMessages([]);
    setStreamingMessage("");
    setSources([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) {
        return;
      }

      setError(null);
      setSources([]);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: message }]);
      setLoading(true);
      setStreamingMessage("");

      try {
        const res = await streamChat({
          message,
          provider: singleProvider,
          ragEnabled,
          byok: byokPayload(),
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
          if (done) {
            break;
          }

          buffer += decoder.decode(value);
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) {
              continue;
            }

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
              // Surface a backend stream error (e.g. empty reasoning output),
              // carrying its reason so the catch handler can localize a BYOK
              // own-key rate-limit (PH18/8).
              throw new StreamError(event.content, event.reason ?? null);
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: fullResponse },
        ]);
        setStreamingMessage("");
        setSources(streamSources);
      } catch (err) {
        // A provider rate-limit on the user's *own* key means their provider
        // account is exhausted — a distinct, localized message from our quota
        // (PH18/8, D-13). Everything else surfaces the raw backend message.
        const ownKeyRateLimited =
          err instanceof StreamError &&
          err.reason === "rate_limited" &&
          byokModelId(singleProvider) !== null;
        if (ownKeyRateLimited) {
          setError({ messageKey: "errors.ownKeyRateLimited" });
        } else {
          setError({ message: err instanceof Error ? err.message : undefined });
        }
        setStreamingMessage("");
      } finally {
        setLoading(false);
      }
    },
    [singleProvider, ragEnabled, byokPayload, byokModelId],
  );

  const hasSingleThread = messages.length > 0 || streamingMessage !== "";

  const value = useMemo<ComposerValue>(
    () => ({
      singleProvider,
      setSingleProvider,
      messages,
      loading,
      streamingMessage,
      sources,
      error,
      hasSingleThread,
      sendMessage,
      clear,
    }),
    [
      singleProvider,
      messages,
      loading,
      streamingMessage,
      sources,
      error,
      hasSingleThread,
      sendMessage,
      clear,
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
