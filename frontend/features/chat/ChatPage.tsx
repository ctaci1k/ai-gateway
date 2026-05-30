// frontend/features/chat/ChatPage.tsx

"use client";

import { useState } from "react";

import ChatContainer from "@/components/chat/ChatContainer";
import ComposerTools from "@/components/chat/ComposerTools";
import ErrorBanner from "@/components/chat/ErrorBanner";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageList from "@/components/chat/MessageList";
import PromptInput from "@/components/chat/PromptInput";
import RagSources from "@/components/rag/RagSources";
import { IconClose } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

import { useChat } from "./useChat";

export default function ChatPage() {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const { messages, loading, sendMessage, streamingMessage, sources, error, clear } = useChat();

  const isEmpty = messages.length === 0 && !loading && !streamingMessage;
  const canClear = messages.length > 0 || streamingMessage !== "";

  function submit() {
    void sendMessage(message);
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

      {error && (
        <div className="chat-top">
          <ErrorBanner error={error} />
        </div>
      )}

      <div className="msgs">
        {isEmpty ? (
          <div className="msgs-empty">{t("chat.empty")}</div>
        ) : (
          <>
            <MessageList messages={messages} />
            {streamingMessage && <MessageBubble role="assistant" content={streamingMessage} />}
            {sources.length > 0 && <RagSources sources={sources} />}
          </>
        )}
      </div>

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
