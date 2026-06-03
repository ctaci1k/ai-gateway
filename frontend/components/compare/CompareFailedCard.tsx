// frontend/components/compare/CompareFailedCard.tsx
//
// A column for a responder that failed this turn (PH13): instead of silently
// dropping to fewer cards, the model is shown with a localized reason
// (rate-limited / timeout / empty / unavailable) so the user understands why.

"use client";

import { useI18n } from "@/store/LanguageContext";
import type { FailedProvider, FailureReason } from "@/types/api";
import { modelDisplay } from "@/utils/models";

const REASON_KEY: Record<FailureReason, string> = {
  rate_limited: "compare.fail.rateLimited",
  timeout: "compare.fail.timeout",
  empty_response: "compare.fail.emptyResponse",
  unavailable: "compare.fail.unavailable",
};

export default function CompareFailedCard({ failed }: { failed: FailedProvider }) {
  const { t } = useI18n();

  // Truthful name (PH32, D-22): a replayed failed card is self-describing — it
  // reads the key source + real model FROM THE SAVED TURN (failed.is_byok /
  // failed.model), never the current keys. Built-in → friendly slot label; own
  // key → the real model id.
  const name = modelDisplay(failed.provider, failed.model, !!failed.is_byok);

  // A rate-limit on the user's *own* key means their provider account is
  // exhausted — a distinct message from the app's shared-key rate limit
  // (PH18/8, D-13). Read from the saved turn (self-describing), not current keys.
  const ownKeyRateLimited = failed.reason === "rate_limited" && !!failed.is_byok;
  const reasonKey = ownKeyRateLimited
    ? "compare.fail.ownKeyRateLimited"
    : failed.reason
      ? REASON_KEY[failed.reason]
      : "compare.fail.unavailable";

  return (
    <div className="rcard rcard-fail">
      <div className="rcard-flag rcard-flag--fail">{t("compare.failedFlag")}</div>
      <div className="rcard-head">
        <div>
          <div className="rcard-name">{name}</div>
        </div>
      </div>
      <p className="rcard-fail-reason">{t(reasonKey)}</p>
    </div>
  );
}
