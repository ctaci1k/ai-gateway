// frontend/components/compare/CompareFailedCard.tsx
//
// A column for a responder that failed this turn (PH13): instead of silently
// dropping to fewer cards, the model is shown with a localized reason
// (rate-limited / timeout / empty / unavailable) so the user understands why.

"use client";

import { useI18n } from "@/store/LanguageContext";
import type { FailedProvider, FailureReason } from "@/types/api";

const REASON_KEY: Record<FailureReason, string> = {
  rate_limited: "compare.fail.rateLimited",
  timeout: "compare.fail.timeout",
  empty_response: "compare.fail.emptyResponse",
  unavailable: "compare.fail.unavailable",
};

export default function CompareFailedCard({ failed }: { failed: FailedProvider }) {
  const { t } = useI18n();
  const reasonKey = failed.reason ? REASON_KEY[failed.reason] : "compare.fail.unavailable";

  return (
    <div className="rcard rcard-fail">
      <div className="rcard-flag rcard-flag--fail">{t("compare.failedFlag")}</div>
      <div className="rcard-head">
        <div>
          <div className="rcard-name">{failed.provider.toUpperCase()}</div>
        </div>
      </div>
      <p className="rcard-fail-reason">{t(reasonKey)}</p>
    </div>
  );
}
