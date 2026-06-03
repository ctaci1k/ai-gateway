// frontend/components/reports/KeyBadge.tsx
//
// Usage Reports — key-source badge (PH31, D-21). Shows whether a model row ran
// on the app's built-in key (a "Built-in" badge) or the user's own BYOK key (the
// display-only mask first4••••last4, e.g. gsk_••••OTzu). Per-user reports only —
// the owner is the only one who ever sees their own mask. Shared by ByModelTab /
// BreakdownTab / ActivityLogTab so the markup + tokens live in one place.

"use client";

import { keySource } from "@/components/reports/reportUtils";
import { useI18n } from "@/store/LanguageContext";

interface KeyBadgeProps {
  fingerprint: string | null | undefined;
}

export default function KeyBadge({ fingerprint }: KeyBadgeProps) {
  const { t } = useI18n();
  const { builtin, mask } = keySource(fingerprint);
  if (builtin) {
    return <span className="rep-keybadge rep-keybadge--builtin">{t("reports.builtinModel")}</span>;
  }
  return (
    <span
      className="rep-keybadge rep-keybadge--own"
      title={t("reports.billing.ownKey")}
      aria-label={`${t("reports.billing.ownKey")}: ${mask}`}
    >
      {mask}
    </span>
  );
}
