// frontend/features/chat/ChatPage.tsx
//
// Single mode (PH24, D-17): Single chats are now saved, named chats. This page
// renders:
//   - the model picker when starting a new Single chat (no model chosen yet);
//   - otherwise the thread — persisted turns from the active saved chat plus the
//     in-flight (optimistic) turn while streaming — and the composer.
// The model is fixed for the chat (header chip is read-only; MainHead handles
// the "change model only in a new chat" hint). RAG file attachment stays (G1).

"use client";

import { useState } from "react";

import ChatContainer from "@/components/chat/ChatContainer";
import ComposerTools from "@/components/chat/ComposerTools";
import ErrorBanner from "@/components/chat/ErrorBanner";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageList from "@/components/chat/MessageList";
import MessageScroll from "@/components/chat/MessageScroll";
import PromptInput from "@/components/chat/PromptInput";
import SingleModelPicker from "@/components/chat/SingleModelPicker";
import RagSources from "@/components/rag/RagSources";
import { useAuth } from "@/store/AuthContext";
import { useChats } from "@/store/ChatsContext";
import { useComposer } from "@/store/ComposerContext";
import { useI18n } from "@/store/LanguageContext";
import type { Message } from "@/types/Message";

export default function ChatPage() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const { activeChatId, activeChat } = useChats();
  const {
    singleProvider,
    loading,
    sendMessage,
    streamingMessage,
    pendingUserMessage,
    sources,
    error,
  } = useComposer();
  const [message, setMessage] = useState("");
  const [scrollSignal, setScrollSignal] = useState(0);

  // Picker state: a new Single chat with no model chosen yet.
  if (!singleProvider && activeChatId === null) {
    return (
      <ChatContainer>
        <SingleModelPicker />
      </ChatContainer>
    );
  }

  // Persisted turns from the active saved Single chat → user + assistant bubbles.
  const savedTurns: Message[] =
    activeChat && activeChat.id === activeChatId && activeChat.mode === "single"
      ? activeChat.messages.flatMap((m) => [
          { id: `u-${m.id}`, role: "user" as const, content: m.payload.user_message },
          { id: `a-${m.id}`, role: "assistant" as const, content: m.payload.best_response },
        ])
      : [];

  const isEmpty = savedTurns.length === 0 && !loading && pendingUserMessage === null;

  const errorText = error
    ? error.messageKey
      ? t(error.messageKey)
      : (error.message ?? t("errors.generic"))
    : null;

  function submit() {
    if (!message.trim() || loading) return;
    setScrollSignal((n) => n + 1);
    void sendMessage(message).then(() => refresh());
    setMessage("");
  }

  return (
    <ChatContainer>
      {errorText && (
        <div className="chat-top">
          <ErrorBanner error={errorText} />
        </div>
      )}

      <MessageScroll scrollSignal={scrollSignal}>
        {isEmpty ? (
          <div className="msgs-empty">{t("single.threadEmpty")}</div>
        ) : (
          <>
            <MessageList messages={savedTurns} />
            {/* In-flight turn (optimistic) while streaming. */}
            {pendingUserMessage !== null && (
              <MessageBubble role="user" content={pendingUserMessage} />
            )}
            {streamingMessage && <MessageBubble role="assistant" content={streamingMessage} />}
            {sources.length > 0 && <RagSources sources={sources} />}
          </>
        )}
      </MessageScroll>

      <PromptInput
        value={message}
        onChange={setMessage}
        loading={loading}
        onSubmit={submit}
        tools={<ComposerTools />}
      />
    </ChatContainer>
  );
}
