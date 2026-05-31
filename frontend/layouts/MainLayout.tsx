// frontend/layouts/MainLayout.tsx

"use client";

import type { ReactNode } from "react";

import { IconInfo, IconMenu } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import { useSidebar } from "@/store/SidebarContext";

interface MainLayoutProps {
  sidebar: ReactNode;
  // Mode-dependent context rendered on the right of the topbar (Single: model
  // switcher + note; Compare: how the mode works).
  topbarContext?: ReactNode;
  children: ReactNode;
}

export default function MainLayout({ sidebar, topbarContext, children }: MainLayoutProps) {
  const { t } = useI18n();
  const { mobileOpen, openMobile, closeMobile } = useSidebar();

  return (
    <div className="app">
      {sidebar}

      {/* Mobile-only scrim behind the open drawer (PH23/C3); click closes it. */}
      {mobileOpen && <div className="sidebar-backdrop" onClick={closeMobile} aria-hidden="true" />}

      <main className="main">
        <header className="topbar">
          <div className="topbar-l">
            <button
              type="button"
              className="topbar-burger"
              onClick={openMobile}
              aria-label={t("sidebar.openMenu")}
              aria-expanded={mobileOpen}
              title={t("sidebar.openMenu")}
            >
              <IconMenu size={20} />
            </button>
            <IconInfo size={17} className="topbar-info" />
            <span>
              <b>{t("topbar.title")}</b> <i className="topbar-sub">— {t("topbar.subtitle")}</i>
            </span>
          </div>
          {topbarContext}
        </header>

        {children}
      </main>
    </div>
  );
}
