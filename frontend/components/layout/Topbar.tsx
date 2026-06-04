// frontend/components/layout/Topbar.tsx
//
// Classic Console top bar (PH24, A2 + D; PH25). Full-width chrome above the body:
//   brand · spacer · theme toggle · usage pill · | · settings ·
//   admin (admin only) · | · account menu.
// PH38: the language switch moved into Settings (third section), so it is no
// longer on the topbar nor in the account menu.
// PH25: Reports moved into the account menu (off the topbar); the Admin button
// uses a "users" icon (managing users), not the shield (which reads as security).
// The mobile burger (left) opens the sidebar drawer (kept from PH23).

"use client";

import { IconGear, IconSparkle, IconUsers } from "@/components/icons/Icons";
import MobileModeBar from "@/components/layout/MobileModeBar";
import AccountMenu from "@/components/topbar/AccountMenu";
import ThemeToggle from "@/components/topbar/ThemeToggle";
import UsagePill from "@/components/topbar/UsagePill";
import { useAdminView } from "@/store/AdminViewContext";
import { useAuth } from "@/store/AuthContext";
import { useI18n } from "@/store/LanguageContext";
import { useReports } from "@/store/ReportsContext";
import { useSettings } from "@/store/SettingsContext";

export default function Topbar() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { open: openAdmin } = useAdminView();
  const { close: closeReports } = useReports();
  const { open: openSettings } = useSettings();

  return (
    <header className="cc-top">
      {/* PH37/M4: the mobile burger is gone — on phones the MobileModeBar (under
          the topbar) replaces the off-canvas sidebar drawer entirely. */}
      <div className="cc-brand" aria-hidden="true">
        <IconSparkle size={19} />
      </div>
      <div className="cc-top-title">
        <b>{t("app.name")}</b>
        <span>{t("topbar.tier")}</span>
      </div>

      {/* PH37: on phones the two mode dropdowns live inside the topbar (left of
          the utility cluster), filling the space the burger used to occupy.
          Mobile-only — `.cc-mmbar` is display:none ≥769px. */}
      <MobileModeBar />

      <div className="cc-spacer" />

      <ThemeToggle />
      <UsagePill />

      <div className="cc-divider" />

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
          className="cc-iconbtn cc-admin-btn"
          onClick={() => {
            closeReports();
            openAdmin();
          }}
          aria-label={t("admin.title")}
          title={t("admin.title")}
        >
          <IconUsers size={18} />
        </button>
      )}

      <div className="cc-divider" />

      <AccountMenu />
    </header>
  );
}
