// frontend/features/compare/ComparePage.tsx

"use client";

import { useEffect, useState } from "react";

import ChatContainer from "@/components/chat/ChatContainer";
import ComposerTools from "@/components/chat/ComposerTools";
import ErrorBanner from "@/components/chat/ErrorBanner";
import PromptInput from "@/components/chat/PromptInput";
import CompareModal from "@/components/compare/CompareModal";
import CompareTurn from "@/components/compare/CompareTurn";
import SelectorBanner from "@/components/selector/SelectorBanner";
import { postManualSelection } from "@/services/preferencesApi";
import { useChats } from "@/store/ChatsContext";
import { useI18n } from "@/store/LanguageContext";

import { useCompare } from "./useCompare";

export default function ComparePage() {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const { activeChatId, activeChat, reloadActive } = useChats();
  const {
    responses,
    failedProviders,
    loading,
    selectedModel,
    setSelectedModel,
    selectorMetadata,
    runCompare,
    hydrate,
    error,
  } = useCompare();

  // Per-turn manual selection in the saved thread, keyed by message id (DB ids
  // are globally unique, so entries never collide across chats); falls back to
  // the persisted pick.
  const [threadSelections, setThreadSelections] = useState<Record<number, string>>({});

  const inThread = activeChatId !== null;
  const winnerModel = selectorMetadata?.selected_model ?? null;

  // Ephemeral view only: clear the live result whenever there is no active chat
  // (the saved thread renders straight from the store, no hydrate needed).
  useEffect(() => {
    if (!inThread) hydrate(null);
  }, [inThread, hydrate]);

  async function submit() {
    const text = message;
    if (!text.trim()) return;
    setMessage("");
    await runCompare(text, { chatId: activeChatId });
    if (activeChatId !== null) {
      void reloadActive();
    }
  }

  function handleEphemeralSelect(provider: string) {
    setSelectedModel(provider);
    void postManualSelection({ selectedModel: provider, selectorModel: winnerModel }).catch(
      () => {},
    );
  }

  function handleThreadSelect(messageId: number, provider: string, judgeModel: string | null) {
    setThreadSelections((prev) => ({ ...prev, [messageId]: provider }));
    void postManualSelection({ selectedModel: provider, selectorModel: judgeModel }).catch(
      () => {},
    );
  }

  const hasResults = responses.length > 0 || failedProviders.length > 0;
  const turns = activeChat && activeChat.id === activeChatId ? activeChat.messages : [];

  return (
    <ChatContainer>
      {!inThread && (selectorMetadata || error) && (
        <div className="chat-top">
          {error ? (
            <ErrorBanner error={error} />
          ) : (
            selectorMetadata && (
              <SelectorBanner
                selectedModel={selectedModel}
                selectorModel={selectorMetadata.selector_model}
                confidence={selectorMetadata.selector_confidence}
                fallback={selectorMetadata.fallback_used}
                fallbackReason={selectorMetadata.fallback_reason}
              />
            )
          )}
        </div>
      )}

      {inThread && error && (
        <div className="chat-top">
          <ErrorBanner error={error} />
        </div>
      )}

      <div className="msgs">
        {inThread ? (
          turns.length === 0 && !loading ? (
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
          )
        ) : loading && !hasResults ? (
          <div className="msgs-empty">{t("common.loading")}</div>
        ) : hasResults ? (
          <CompareModal
            responses={responses}
            failedProviders={failedProviders}
            selectedModel={selectedModel}
            winnerModel={winnerModel}
            judgeModel={selectorMetadata?.selector_model}
            fallback={selectorMetadata?.fallback_used}
            onSelect={handleEphemeralSelect}
          />
        ) : (
          <div className="msgs-empty">{t("compare.empty")}</div>
        )}
      </div>

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
