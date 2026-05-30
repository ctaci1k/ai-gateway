// frontend/components/sidebar/ProfileCard.tsx

"use client";

import { IconUser } from "@/components/icons/Icons";
import { useAuth } from "@/store/AuthContext";
import { useI18n } from "@/store/LanguageContext";

export default function ProfileCard() {
  const { t } = useI18n();
  const { user, logout } = useAuth();

  return (
    <div className="acct">
      <div className="acct-av">
        <IconUser size={17} />
      </div>
      <div>
        <div className="acct-name">{user?.username ?? t("profile.title")}</div>
        <div className="acct-sub">{t("profile.subtitle")}</div>
      </div>
      <button
        className="acct-logout"
        type="button"
        onClick={() => void logout()}
        aria-label={t("auth.logout")}
      >
        {t("auth.logout")}
      </button>
    </div>
  );
}
