// frontend/components/account/LimitBanner.tsx
//
// Limited-account banner (PH15, D-10): shown only for non-admin users that have
// a daily request limit. Unlimited accounts (admins / null limits) see nothing.

"use client";

import { IconInfo } from "@/components/icons/Icons";
import { useAuth } from "@/store/AuthContext";
import { useI18n } from "@/store/LanguageContext";

export default function LimitBanner() {
  const { user } = useAuth();
  const { t } = useI18n();

  // Only limited accounts (a configured daily cap) see the banner.
  if (!user || user.is_admin || user.max_requests_per_day == null) {
    return null;
  }

  const remaining = user.remaining_today ?? 0;

  return (
    <div className="limit-banner" role="status">
      <IconInfo size={16} className="limit-banner-ic" />
      <div className="limit-banner-body">
        <b>{t("limit.title")}</b>
        <span>
          {t("limit.text", {
            perDay: user.max_requests_per_day,
            remaining,
          })}
        </span>
      </div>
    </div>
  );
}
