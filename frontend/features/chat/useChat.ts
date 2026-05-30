// frontend/features/chat/useChat.ts

"use client";

import { useCallback, useState } from "react";

import { streamChat } from "@/services/chatApi";
import { useComposer } from "@/store/ComposerContext";
import { useRagDocuments } from "@/store/RagContext";
import type { RagSource, StreamEvent } from "@/types/api";
import type { Message } from "@/types/Message";

export interface UseChatResult {
  messages: Message[];
  loading: boolean;
  streamingMessage: string;
  sources: RagSource[];
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clear: () => void;
}

export function useChat(): UseChatResult {
  const { singleProvider } = useComposer();
  // RAG is applied automatically whenever the user has any documents.
  const { documents } = useRagDocuments();
  const ragEnabled = documents.length > 0;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [sources, setSources] = useState<RagSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  // B2: clear only the visual thread. Rolling history in the DB is untouched.
  const clear = useCallback(() => {
    setMessages([]);
    setStreamingMessage("");
    setSources([]);
    setError(null);
  }, []);

  async function sendMessage(message: string) {
    if (!message.trim()) {
      return;
    }

    setError(null);
    setSources([]);

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: message }]);

    setLoading(true);
    setStreamingMessage("");

    try {
      const res = await streamChat({ message, provider: singleProvider, ragEnabled });
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
            // Surface a backend stream error (e.g. empty reasoning-model output).
            throw new Error(event.content);
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
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStreamingMessage("");
    } finally {
      setLoading(false);
    }
  }

  return {
    messages,
    loading,
    streamingMessage,
    sources,
    error,
    sendMessage,
    clear,
  };
}
