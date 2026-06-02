// frontend/app/page.tsx

"use client";

import AdminPanel from "@/components/admin/AdminPanel";
import AuthScreen from "@/components/auth/AuthScreen";
import MainHead from "@/components/layout/MainHead";
import ReportsPage from "@/components/reports/ReportsPage";
import ChatPage from "@/features/chat/ChatPage";
import ComparePage from "@/features/compare/ComparePage";
import MainLayout from "@/layouts/MainLayout";
import { useAdminView } from "@/store/AdminViewContext";
import { useAuth } from "@/store/AuthContext";
import { useChatMode } from "@/store/ChatModeContext";
import { useI18n } from "@/store/LanguageContext";
import { useReports } from "@/store/ReportsContext";

export default function Home() {
  const { status, user } = useAuth();
  const { mode } = useChatMode();
  const { isOpen: adminViewOpen } = useAdminView();
  const { isOpen: reportsOpen } = useReports();
  const { t } = useI18n();

  if (status === "loading") {
    return <div className="loading-screen">{t("common.loading")}</div>;
  }

  if (status === "anonymous") {
    return <AuthScreen />;
  }

  // Full-page views are mutually exclusive; Reports takes precedence when open
  // (the entry points also close the other view, so both rarely co-exist).
  const showReports = reportsOpen;
  const showAdmin = !showReports && adminViewOpen && Boolean(user?.is_admin);

  return (
    <MainLayout>
      {showReports ? (
        <ReportsPage />
      ) : showAdmin ? (
        <AdminPanel />
      ) : (
        <>
          <MainHead />
          <div className="cc-stage">
            {mode === "single" && <ChatPage />}
            {mode === "compare" && <ComparePage />}
          </div>
        </>
      )}
    </MainLayout>
  );
}
