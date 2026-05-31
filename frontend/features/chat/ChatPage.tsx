// frontend/features/chat/ChatPage.tsx

"use client";

import { useState } from "react";

import ChatContainer from "@/components/chat/ChatContainer";
import ComposerTools from "@/components/chat/ComposerTools";
import ErrorBanner from "@/components/chat/ErrorBanner";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageList from "@/components/chat/MessageList";
import MessageScroll from "@/components/chat/MessageScroll";
import PromptInput from "@/components/chat/PromptInput";
import RagSources from "@/components/rag/RagSources";
import { IconClose } from "@/components/icons/Icons";
import { useAuth } from "@/store/AuthContext";
import { useComposer } from "@/store/ComposerContext";
import { useI18n } from "@/store/LanguageContext";

export default function ChatPage() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const [message, setMessage] = useState("");
  const [scrollSignal, setScrollSignal] = useState(0);
  const { messages, loading, sendMessage, streamingMessage, sources, error, clear } = useComposer();

  const isEmpty = messages.length === 0 && !loading && !streamingMessage;
  const canClear = messages.length > 0 || streamingMessage !== "";

  // Resolve the structured composer error: a translation key wins, else the raw
  // backend message, else a generic fallback (texts via t() — golden rule).
  const errorText = error
    ? error.messageKey
      ? t(error.messageKey)
      : (error.message ?? t("errors.generic"))
    : null;

  function submit() {
    if (!message.trim() || loading) return;
    // Jump the feed to the newest message as the turn starts.
    setScrollSignal((n) => n + 1);
    // Refresh quota usage once the turn finishes so the limit banner is live.
    void sendMessage(message).then(() => refresh());
    setMessage("");
  }

  return (
    <ChatContainer>
      <div className="single-bar">
        <button
          type="button"
          className="single-clear"
          onClick={clear}
          disabled={!canClear}
          title={t("single.clear")}
        >
          <IconClose size={14} />
          <span>{t("single.clear")}</span>
        </button>
      </div>

      {errorText && (
        <div className="chat-top">
          <ErrorBanner error={errorText} />
        </div>
      )}

      <MessageScroll scrollSignal={scrollSignal}>
        {isEmpty ? (
          <div className="msgs-empty">{t("chat.empty")}</div>
        ) : (
          <>
            <MessageList messages={messages} />
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
