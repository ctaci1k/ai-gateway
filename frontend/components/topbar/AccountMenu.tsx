// frontend/components/topbar/AccountMenu.tsx
//
// Topbar account dropdown (PH24, D2; PH25): avatar + name + role trigger; menu
// with Profile & Avatar (stub), Reports (stub — for everyone), Security (stub)
// and a real Sign out. Built on the shared a11y Dropdown.
// PH25: Account settings is NOT duplicated here — Settings stays as the separate
// gear button in the topbar; Reports lives only here (removed from the topbar).

"use client";

import Dropdown from "@/components/common/Dropdown";
import {
  IconChevron,
  IconLogout,
  IconReport,
  IconShield,
  IconUser,
  IconUsers,
} from "@/components/icons/Icons";
import CreatorCard from "@/components/sidebar/CreatorCard";
import Avatar from "@/components/topbar/Avatar";
import { useAdminView } from "@/store/AdminViewContext";
import { useAuth } from "@/store/AuthContext";
import { useComingSoon } from "@/store/ComingSoonContext";
import { useI18n } from "@/store/LanguageContext";
import { useReports } from "@/store/ReportsContext";

export default function AccountMenu() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { open: openStub } = useComingSoon();
  const { open: openReports, close: closeReports } = useReports();
  const { open: openAdmin, close: closeAdmin } = useAdminView();

  const name = user?.username ?? t("profile.title");
  const role = user?.is_admin ? t("admin.roleAdmin") : t("admin.roleUser");

  return (
    <Dropdown
      label={t("account.menu")}
      className="cc-dd-acct"
      renderTrigger={(open, toggle) => (
        <button
          type="button"
          className={open ? "cc-userbtn is-open" : "cc-userbtn"}
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("account.menu")}
        >
          <Avatar name={name} size={30} />
          <span className="cc-userbtn-tx">
            <b>{name}</b>
            <span>{role}</span>
          </span>
          <IconChevron size={15} style={{ color: "var(--subtle)" }} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="cc-acct-head">
            <Avatar name={name} size={42} ring />
            <div className="cc-acct-id">
              <b>{name}</b>
              <span>{role}</span>
            </div>
          </div>
          <div className="cc-menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="cc-menu-item"
            onClick={() => {
              openStub("profile");
              close();
            }}
          >
            <IconUser size={16} />
            <span className="lab">{t("account.profile")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="cc-menu-item"
            onClick={() => {
              closeAdmin();
              openReports();
              close();
            }}
          >
            <IconReport size={16} />
            <span className="lab">{t("reports.title")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="cc-menu-item"
            onClick={() => {
              openStub("security");
              close();
            }}
          >
            <IconShield size={16} />
            <span className="lab">{t("account.security")}</span>
          </button>
          {/* PH37/M5: on mobile the Admin entry moves here (it leaves the topbar
              ≤768px). Mirrors the cc-menu-creator pattern — hidden ≥769px so the
              desktop topbar keeps Admin. PH38: the language switch is no longer
              here — it lives in Settings (third section) on every viewport. */}
          {user?.is_admin && (
            <div className="cc-menu-mobileonly">
              <div className="cc-menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="cc-menu-item"
                onClick={() => {
                  closeReports();
                  openAdmin();
                  close();
                }}
              >
                <IconUsers size={16} />
                <span className="lab">{t("admin.title")}</span>
              </button>
            </div>
          )}
          {/* PH35/S13: on mobile the creator card moves here (between Security and
              Logout, fenced by separators). One CreatorCard reused via variant;
              CSS hides the sidebar copy ≤768px so it never duplicates. */}
          <div className="cc-menu-creator">
            <div className="cc-menu-sep" />
            <CreatorCard variant="menu" />
          </div>
          <div className="cc-menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="cc-menu-item cc-menu-danger"
            onClick={() => {
              close();
              void logout();
            }}
          >
            <IconLogout size={16} />
            <span className="lab">{t("auth.logout")}</span>
          </button>
        </>
      )}
    </Dropdown>
  );
}
