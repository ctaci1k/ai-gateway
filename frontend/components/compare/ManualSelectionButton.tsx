// frontend/components/compare/ManualSelectionButton.tsx

"use client";

import { IconCheck, IconStar, IconSwap } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

interface ManualSelectionButtonProps {
  winner?: boolean;
  selected?: boolean;
  // True when this turn's winner was chosen by the rule-based fallback, not the
  // AI judge — so the label tells the truth about who picked it (D1).
  fallback?: boolean;
  // Friendly judge model name (e.g. "Qwen"), shown next to the judge label so
  // the UI never hardcodes a vendor name (D-9). Null when unknown.
  judgeName?: string | null;
  onSelect?: () => void;
}

export default function ManualSelectionButton({
  winner = false,
  selected = false,
  fallback = false,
  judgeName = null,
  onSelect = () => {},
}: ManualSelectionButtonProps) {
  const { t } = useI18n();

  // The active choice (what's currently selected).
  if (selected) {
    // It's the judge's/fallback's own pick → label who chose it; otherwise it's
    // the user's manual override.
    const label = winner
      ? fallback
        ? t("cta.selectedByFallback")
        : t("cta.selectedByJudge") + (judgeName ? ` (${judgeName})` : "")
      : t("cta.yourChoice");
    return (
      <button className="cta cta-win" disabled>
        {winner ? <IconStar size={15} /> : <IconCheck size={16} />}
        <span>{label}</span>
      </button>
    );
  }

  // Not selected. The winner card stays reachable so a manual pick is always
  // reversible — you can agree with the model the judge proposed (A2/D1).
  if (winner) {
    return (
      <button className="cta cta-confirm" onClick={onSelect}>
        <IconStar size={15} />
        <span>{t("cta.agreeWithJudge")}</span>
      </button>
    );
  }

  return (
    <button className="cta cta-change" onClick={onSelect}>
      <IconSwap size={16} />
      <span>{t("cta.change")}</span>
    </button>
  );
}
