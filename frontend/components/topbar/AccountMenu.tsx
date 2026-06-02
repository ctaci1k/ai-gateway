// frontend/components/topbar/AccountMenu.tsx
//
// Topbar account dropdown (PH24, D2): avatar + name + role trigger; menu with
// Profile & Avatar (stub), Account settings (→ Settings), Security (stub) and a
// real Sign out. Built on the shared a11y Dropdown.

"use client";

import Dropdown from "@/components/common/Dropdown";
import { IconChevron, IconGear, IconLogout, IconShield, IconUser } from "@/components/icons/Icons";
import Avatar from "@/components/topbar/Avatar";
import { useAuth } from "@/store/AuthContext";
import { useComingSoon } from "@/store/ComingSoonContext";
import { useI18n } from "@/store/LanguageContext";
import { useSettings } from "@/store/SettingsContext";

export default function AccountMenu() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { open: openSettings } = useSettings();
  const { open: openStub } = useComingSoon();

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
              openSettings("judge");
              close();
            }}
          >
            <IconGear size={16} />
            <span className="lab">{t("account.settings")}</span>
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
