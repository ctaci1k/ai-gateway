// frontend/components/selector/SelectorBanner.tsx

"use client";

import { IconInfo } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import type { FallbackReason } from "@/types/api";
import { judgeModelName } from "@/utils/judge";

interface SelectorBannerProps {
  selectedModel?: string | null;
  // The judge model id (selector_metadata.selector_model). Drives the friendly
  // label so the UI never hardcodes a vendor name (D-9).
  selectorModel?: string | null;
  confidence?: number;
  fallback?: boolean;
  fallbackReason?: FallbackReason | null;
}

// Concrete fallback reason → i18n key (D1). Unknown/missing falls back to the
// generic "judge unavailable" wording.
const REASON_KEY: Record<FallbackReason, string> = {
  judge_unavailable: "banner.reason.judgeUnavailable",
  invalid_response: "banner.reason.invalidResponse",
  low_confidence: "banner.reason.lowConfidence",
};

export default function SelectorBanner({
  selectedModel,
  selectorModel = null,
  confidence,
  fallback = false,
  fallbackReason = null,
}: SelectorBannerProps) {
  const { t } = useI18n();
  const reasonText = fallbackReason ? t(REASON_KEY[fallbackReason]) : null;
  const judgeName = judgeModelName(selectorModel);

  return (
    <div className="banner">
      <span className="banner-ic">
        <IconInfo size={16} />
      </span>
      <div className="banner-body">
        {fallback ? (
          <>
            <b>{t("banner.fallbackTitle")}</b> {reasonText ?? t("banner.fallbackUsed")}
          </>
        ) : (
          <>
            <b>
              {t("selector.title")}
              {judgeName ? ` (${judgeName})` : ""}
            </b>{" "}
            — {t("selector.selected")} {selectedModel || t("common.unknown")} ·{" "}
            {t("selector.confidence")} {Number(confidence || 0).toFixed(2)}
          </>
        )}
      </div>
    </div>
  );
}
