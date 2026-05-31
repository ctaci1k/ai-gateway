// frontend/components/account/LimitBanner.tsx
//
// Limited-account banner (PH15, D-10; live windows PH17/C2): shown only for
// non-admin users that have a per-minute and/or per-day request limit.
// Unlimited dimensions (null limit) hide their row; admins / fully-unlimited
// accounts see nothing.
//
// The per-minute window is fixed (PH18/6, D-13): it "opens" with the first
// request and resets *fully* to the limit at the 60s mark. A 1s client ticker
// counts down from the server's minute_resets_in_seconds and refetches /auth/me
// when it hits 0 — so the count jumps straight back to the full limit, never
// slot-by-slot. The day window resets at 00:00 Polish time (static note, no timer).

"use client";

import { useEffect, useState } from "react";

import { IconInfo } from "@/components/icons/Icons";
import { useAuth } from "@/store/AuthContext";
import { useI18n } from "@/store/LanguageContext";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function LimitBanner() {
  const { user, refresh } = useAuth();
  const { t } = useI18n();

  // Server-provided countdown anchor (null when the window has no requests yet
  // or the minute is unlimited). The local ticker decrements from it.
  const minuteResets = user?.minute_resets_in_seconds ?? null;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(minuteResets);

  // Re-sync when the server value changes (after a request / refresh). This is
  // React's "adjust state during render" pattern — not a setState-in-effect.
  const [anchor, setAnchor] = useState<number | null>(minuteResets);
  if (minuteResets !== anchor) {
    setAnchor(minuteResets);
    setSecondsLeft(minuteResets);
  }

  // 1s ticker; when it reaches 0 the minute window has reset → refetch once.
  useEffect(() => {
    if (secondsLeft == null) return undefined;
    if (secondsLeft <= 0) {
      void refresh();
      return undefined;
    }
    const id = setTimeout(() => {
      setSecondsLeft((prev) => (prev == null ? prev : prev - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, refresh]);

  if (!user || user.is_admin) return null;

  const perMinute = user.max_requests_per_minute;
  const perDay = user.max_requests_per_day;
  const minuteLimited = perMinute != null;
  const dayLimited = perDay != null;
  if (!minuteLimited && !dayLimited) return null;

  // Within each guarded row the matching limit is non-null (`?? 0` never fires).
  const remainingMinute = user.remaining_this_minute ?? perMinute ?? 0;
  const remainingDay = user.remaining_today ?? perDay ?? 0;
  const showTimer = secondsLeft != null && secondsLeft > 0;

  return (
    <div className="limit-banner" role="status">
      <IconInfo size={16} className="limit-banner-ic" />
      <div className="limit-banner-body">
        <b>{t("limit.title")}</b>
        <span className="limit-intro">{t("limit.intro")}</span>

        {minuteLimited && (
          <span className="limit-row">
            <span>
              {t("limit.minute", {
                remaining: remainingMinute,
                perMinute: perMinute ?? 0,
              })}
            </span>
            {showTimer && (
              <span className="limit-reset">
                {t("limit.minuteReset", { time: formatCountdown(secondsLeft as number) })}
              </span>
            )}
          </span>
        )}

        {dayLimited && (
          <span className="limit-row">
            <span>
              {t("limit.day", {
                remaining: remainingDay,
                perDay: perDay ?? 0,
              })}
            </span>
            <span className="limit-reset">{t("limit.dayReset")}</span>
          </span>
        )}
      </div>
    </div>
  );
}
