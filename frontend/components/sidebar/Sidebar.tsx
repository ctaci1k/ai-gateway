// frontend/components/sidebar/Sidebar.tsx

"use client";

import LimitBanner from "@/components/account/LimitBanner";
import { IconGrid } from "@/components/icons/Icons";
import { useAdminView } from "@/store/AdminViewContext";
import { useAuth } from "@/store/AuthContext";
import { useChatMode } from "@/store/ChatModeContext";
import { useI18n } from "@/store/LanguageContext";

import AuthorCard from "./AuthorCard";
import ChatList from "./ChatList";
import ChatModeSelector from "./ChatModeSelector";
import LanguageSwitcher from "./LanguageSwitcher";
import NewChatButton from "./NewChatButton";
import ProfileCard from "./ProfileCard";

export default function Sidebar() {
  const { mode } = useChatMode();
  const { user } = useAuth();
  const { open } = useAdminView();
  const { t } = useI18n();
  // Saved chats are Compare-only (B5): Single has no saved-chats section.
  const showSavedChats = mode === "compare";

  return (
    <aside className="sidebar">
      <ProfileCard />
      <ChatModeSelector />
      {showSavedChats && (
        <>
          <NewChatButton />
          <ChatList />
        </>
      )}
      <LanguageSwitcher />
      {user?.is_admin && (
        <button className="sidebar-admin" type="button" onClick={open}>
          <IconGrid size={16} />
          {t("admin.nav")}
        </button>
      )}
      <LimitBanner />
      <AuthorCard />
    </aside>
  );
}
