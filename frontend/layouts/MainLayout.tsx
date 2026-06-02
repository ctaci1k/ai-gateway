// frontend/layouts/MainLayout.tsx
//
// Classic Console shell (PH24): a full-width topbar above a body row of the
// accordion sidebar + main content. Global overlays (Settings, the "in
// development" stub) mount here so they're available from anywhere.

"use client";

import type { ReactNode } from "react";

import ComingSoonModal from "@/components/common/ComingSoonModal";
import Topbar from "@/components/layout/Topbar";
import ReportsModal from "@/components/reports/ReportsModal";
import SettingsModal from "@/components/settings/SettingsModal";
import Sidebar from "@/components/sidebar/Sidebar";
import { useSidebar } from "@/store/SidebarContext";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { mobileOpen, closeMobile } = useSidebar();

  return (
    <div className="cc-root">
      <Topbar />
      <div className="cc-body">
        <Sidebar />
        {/* Mobile-only scrim behind the open drawer; click closes it. */}
        {mobileOpen && <div className="cc-backdrop" onClick={closeMobile} aria-hidden="true" />}
        <main className="cc-main">{children}</main>
      </div>

      <SettingsModal />
      <ReportsModal />
      <ComingSoonModal />
    </div>
  );
}
