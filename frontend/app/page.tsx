// frontend/app/page.tsx

"use client";

import AdminPanel from "@/components/admin/AdminPanel";
import AuthScreen from "@/components/auth/AuthScreen";
import TopbarModeContext from "@/components/chat/TopbarModeContext";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatPage from "@/features/chat/ChatPage";
import ComparePage from "@/features/compare/ComparePage";
import ChatLayout from "@/layouts/ChatLayout";
import MainLayout from "@/layouts/MainLayout";
import { useAdminView } from "@/store/AdminViewContext";
import { useAuth } from "@/store/AuthContext";
import { useChatMode } from "@/store/ChatModeContext";
import { useI18n } from "@/store/LanguageContext";

export default function Home() {
  const { status, user } = useAuth();
  const { mode } = useChatMode();
  const { isOpen: adminViewOpen } = useAdminView();
  const { t } = useI18n();

  if (status === "loading") {
    return <div className="loading-screen">{t("common.loading")}</div>;
  }

  if (status === "anonymous") {
    return <AuthScreen />;
  }

  const showAdmin = adminViewOpen && Boolean(user?.is_admin);

  return (
    <MainLayout sidebar={<Sidebar />} topbarContext={showAdmin ? undefined : <TopbarModeContext />}>
      {showAdmin ? (
        <AdminPanel />
      ) : (
        <ChatLayout>
          {mode === "single" && <ChatPage />}
          {mode === "compare" && <ComparePage />}
        </ChatLayout>
      )}
    </MainLayout>
  );
}
