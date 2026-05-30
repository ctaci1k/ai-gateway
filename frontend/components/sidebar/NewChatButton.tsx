// frontend/components/sidebar/NewChatButton.tsx

"use client";

import { IconPlus } from "@/components/icons/Icons";
import { useChats } from "@/store/ChatsContext";
import { useI18n } from "@/store/LanguageContext";

export default function NewChatButton() {
  const { t } = useI18n();
  const { newChat, notice } = useChats();

  // A3: the button is always clickable; when blocked (current chat still empty,
  // or limit reached) newChat() surfaces a notice instead of creating a chat.
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
          {t(notice)}
        </div>
      )}
    </>
  );
}
