// frontend/layouts/MainLayout.tsx

"use client";

import type { ReactNode } from "react";

import { IconInfo } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

interface MainLayoutProps {
  sidebar: ReactNode;
  // Mode-dependent context rendered on the right of the topbar (Single: model
  // switcher + note; Compare: how the mode works).
  topbarContext?: ReactNode;
  children: ReactNode;
}

export default function MainLayout({ sidebar, topbarContext, children }: MainLayoutProps) {
  const { t } = useI18n();

  return (
    <div className="app">
      {sidebar}

      <main className="main">
        <header className="topbar">
          <div className="topbar-l">
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
