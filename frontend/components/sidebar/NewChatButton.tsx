// frontend/components/sidebar/NewChatButton.tsx

"use client";

import { IconPlus } from "@/components/icons/Icons";
import { SAVED_CHATS_LIMIT, useChats } from "@/store/ChatsContext";
import { useI18n } from "@/store/LanguageContext";

export default function NewChatButton() {
  const { t } = useI18n();
  const { newChat, notice } = useChats();

  // The button is always clickable; "+" opens an empty draft (F2). When the
  // limit is reached, newChat() surfaces a notice instead of opening a draft.
  return (
    <>
      <button
        className="newchat"
        type="button"
        onClick={() => void newChat()}
        title={t("chatList.newCompareChat")}
      >
        <IconPlus size={16} />
        <span>{t("chatList.newCompareChat")}</span>
      </button>
      {notice && (
        <div className="newchat-notice" role="status">
          {t(notice, { limit: SAVED_CHATS_LIMIT })}
        </div>
      )}
    </>
  );
}
