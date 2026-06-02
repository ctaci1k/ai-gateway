// frontend/components/topbar/UsagePill.tsx
//
// Topbar usage indicator (PH24, G3) — enterprise convention: a compact "X/N"
// pill with a popover detailing the per-minute / per-day remaining quota and
// reset times, plus an own-key note. Replaces the sidebar LimitBanner /
// KeysStatusBanner; the per-composer "exhausted / own-key rate-limit" notice
// stays near the composer.
//
// Visibility:
//   - limited (non-admin with a limit): the "X/N" pill (red when none left).
//   - unlimited but on own key(s): a green "own key" pill.
//   - otherwise (admin / unlimited, no own key): nothing.
//
// The per-minute window is fixed (D-13): a 1s ticker counts down from the
// server's minute_resets_in_seconds and refetches /auth/me at 0, so the count
// jumps back to the full limit rather than slot-by-slot.

"use client";

import { useEffect, useState } from "react";

import Dropdown from "@/components/common/Dropdown";
import { IconCheck, IconInfo } from "@/components/icons/Icons";
import { useAuth } from "@/store/AuthContext";
import { useI18n } from "@/store/LanguageContext";
import { useSidebarStatus } from "@/store/sidebarStatus";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function UsagePill() {
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const { byok, limited } = useSidebarStatus();

  const minuteResets = user?.minute_resets_in_seconds ?? null;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(minuteResets);

  // Re-sync the ticker when the server value changes (render-time adjust).
  const [anchor, setAnchor] = useState<number | null>(minuteResets);
  if (minuteResets !== anchor) {
    setAnchor(minuteResets);
    setSecondsLeft(minuteResets);
  }

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

  if (!user) return null;

  const byokOk = byok?.tone === "ok";

  // Unlimited but on own key → a compact green "own key" pill, no popover detail.
  if (!limited) {
    if (!byokOk) return null;
    return (
      <span className="cc-usage cc-usage--ok" role="status" title={t("status.ownKey")}>
        <IconCheck size={14} />
        <span className="cc-usage-tx">{t("usage.ownKey")}</span>
      </span>
    );
  }

  const perMinute = user.max_requests_per_minute;
  const perDay = user.max_requests_per_day;
  const remainingMinute = user.remaining_this_minute ?? perMinute ?? 0;
  const remainingDay = user.remaining_today ?? perDay ?? 0;
  const showTimer = secondsLeft != null && secondsLeft > 0;

  // Primary number on the pill: minute remaining if minute-limited, else daily.
  const primaryRemaining = perMinute != null ? remainingMinute : remainingDay;
  const primaryMax = perMinute != null ? perMinute : (perDay ?? 0);
  const exhausted = primaryRemaining <= 0;

  return (
    <Dropdown
      label={t("usage.title")}
      className="cc-dd-usage"
      renderTrigger={(open, toggle) => (
        <button
          type="button"
          className={"cc-usage" + (exhausted ? " cc-usage--danger" : "") + (open ? " is-open" : "")}
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("usage.title")}
        >
          <IconInfo size={14} />
          <span className="cc-usage-tx">
            {primaryRemaining}/{primaryMax}
          </span>
        </button>
      )}
    >
      {() => (
        <div className="cc-usage-pop">
          <div className="cc-menu-cap">{t("usage.title")}</div>
          <p className="cc-usage-intro">{t("limit.intro")}</p>
          {perMinute != null && (
            <div className="cc-usage-row">
              <span>{t("limit.minute", { remaining: remainingMinute, perMinute })}</span>
              {showTimer && (
                <span className="cc-usage-reset">
                  {t("limit.minuteReset", {
                    time: formatCountdown(secondsLeft as number),
                  })}
                </span>
              )}
            </div>
          )}
          {perDay != null && (
            <div className="cc-usage-row">
              <span>{t("limit.day", { remaining: remainingDay, perDay })}</span>
              <span className="cc-usage-reset">{t("limit.dayReset")}</span>
            </div>
          )}
          {byokOk && (
            <p className="cc-usage-own">
              <IconCheck size={13} /> {t("status.ownKey")}
            </p>
          )}
        </div>
      )}
    </Dropdown>
  );
}
