// frontend/features/compare/ComparePage.tsx

"use client";

import { useState } from "react";

import ChatContainer from "@/components/chat/ChatContainer";
import ComposerTools from "@/components/chat/ComposerTools";
import ErrorBanner from "@/components/chat/ErrorBanner";
import MessageScroll from "@/components/chat/MessageScroll";
import PromptInput from "@/components/chat/PromptInput";
import CompareTurn from "@/components/compare/CompareTurn";
import { postManualSelection } from "@/services/preferencesApi";
import { useAuth } from "@/store/AuthContext";
import { useChats } from "@/store/ChatsContext";
import { useI18n } from "@/store/LanguageContext";
import { deriveChatTitle } from "@/utils/chatTitle";

import { useCompare } from "./useCompare";

export default function ComparePage() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const [message, setMessage] = useState("");
  const [scrollSignal, setScrollSignal] = useState(0);
  const { activeChatId, activeChat, createActiveChat, reloadActive } = useChats();
  const { loading, runCompare, error } = useCompare();

  // Per-turn manual selection in the saved thread, keyed by message id (DB ids
  // are globally unique, so entries never collide across chats); falls back to
  // the persisted pick.
  const [threadSelections, setThreadSelections] = useState<Record<number, string>>({});

  const inThread = activeChatId !== null;

  async function submit() {
    const text = message;
    if (!text.trim() || loading) return;
    setMessage("");
    // Jump the thread to the newest turn as it starts.
    setScrollSignal((n) => n + 1);

    // F1/F3: the first message of a draft auto-creates a chat titled after it.
    let chatId = activeChatId;
    if (chatId === null) {
      chatId = await createActiveChat(deriveChatTitle(text), "compare");
      if (chatId === null) return; // limit reached / error — notice is shown
    }

    await runCompare(text, { chatId });
    void reloadActive(chatId);
    // Refresh quota usage so the limit banner reflects this turn live.
    void refresh();
  }

  function handleThreadSelect(messageId: number, provider: string, judgeModel: string | null) {
    setThreadSelections((prev) => ({ ...prev, [messageId]: provider }));
    void postManualSelection({ selectedModel: provider, selectorModel: judgeModel }).catch(
      () => {},
    );
  }

  const turns = activeChat && activeChat.id === activeChatId ? activeChat.messages : [];

  return (
    <ChatContainer>
      {error && (
        <div className="chat-top">
          <ErrorBanner error={error} />
        </div>
      )}

      <MessageScroll scrollSignal={scrollSignal}>
        {!inThread ? (
          <div className="msgs-empty">{t("compare.empty")}</div>
        ) : turns.length === 0 && !loading ? (
          <div className="msgs-empty">{t("compare.threadEmpty")}</div>
        ) : (
          <div className="compare-thread">
            {turns.map((msg) => {
              const payload = msg.payload;
              const selected =
                threadSelections[msg.id] ??
                payload.manually_selected_model ??
                payload.selected_model ??
                null;
              return (
                <CompareTurn
                  key={msg.id}
                  interaction={payload}
                  selectedModel={selected}
                  onSelect={(provider) =>
                    handleThreadSelect(msg.id, provider, payload.selected_model)
                  }
                />
              );
            })}
            {loading && <div className="msgs-empty">{t("common.loading")}</div>}
          </div>
        )}
      </MessageScroll>

      <PromptInput
        value={message}
        onChange={setMessage}
        loading={loading}
        onSubmit={() => void submit()}
        placeholderKey="compare.placeholder"
        tools={<ComposerTools />}
      />
    </ChatContainer>
  );
}
