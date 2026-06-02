// frontend/components/layout/Topbar.tsx
//
// Classic Console top bar (PH24, A2 + D). Full-width chrome above the body:
//   brand · spacer · theme toggle · language menu · usage pill · | · reports ·
//   settings · admin (admin only) · | · account menu.
// The mobile burger (left) opens the sidebar drawer (kept from PH23).

"use client";

import { IconGear, IconMenu, IconReport, IconShield, IconSparkle } from "@/components/icons/Icons";
import AccountMenu from "@/components/topbar/AccountMenu";
import LangMenu from "@/components/topbar/LangMenu";
import ThemeToggle from "@/components/topbar/ThemeToggle";
import UsagePill from "@/components/topbar/UsagePill";
import { useAdminView } from "@/store/AdminViewContext";
import { useAuth } from "@/store/AuthContext";
import { useComingSoon } from "@/store/ComingSoonContext";
import { useI18n } from "@/store/LanguageContext";
import { useSettings } from "@/store/SettingsContext";
import { useSidebar } from "@/store/SidebarContext";

export default function Topbar() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { mobileOpen, openMobile } = useSidebar();
  const { open: openAdmin } = useAdminView();
  const { open: openSettings } = useSettings();
  const { open: openStub } = useComingSoon();

  return (
    <header className="cc-top">
      <button
        type="button"
        className="cc-burger"
        onClick={openMobile}
        aria-label={t("sidebar.openMenu")}
        aria-expanded={mobileOpen}
        title={t("sidebar.openMenu")}
      >
        <IconMenu size={20} />
      </button>

      <div className="cc-brand" aria-hidden="true">
        <IconSparkle size={19} />
      </div>
      <div className="cc-top-title">
        <b>{t("app.name")}</b>
        <span>{t("topbar.tier")}</span>
      </div>

      <div className="cc-spacer" />

      <ThemeToggle />
      <LangMenu />
      <UsagePill />

      <div className="cc-divider" />

      <button
        type="button"
        className="cc-iconbtn"
        onClick={() => openStub("reports")}
        aria-label={t("reports.title")}
        title={t("reports.title")}
      >
        <IconReport size={18} />
      </button>
      <button
        type="button"
        className="cc-iconbtn"
        onClick={() => openSettings("judge")}
        aria-label={t("settings.title")}
        title={t("settings.title")}
      >
        <IconGear size={18} />
      </button>
      {user?.is_admin && (
        <button
          type="button"
          className="cc-iconbtn"
          onClick={openAdmin}
          aria-label={t("admin.title")}
          title={t("admin.title")}
        >
          <IconShield size={18} />
        </button>
      )}

      <div className="cc-divider" />

      <AccountMenu />
    </header>
  );
}
