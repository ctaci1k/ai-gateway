// frontend/components/compare/CompareFailedCard.tsx
//
// A column for a responder that failed this turn (PH13): instead of silently
// dropping to fewer cards, the model is shown with a localized reason
// (rate-limited / timeout / empty / unavailable) so the user understands why.

"use client";

import { useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";
import type { FailedProvider, FailureReason } from "@/types/api";
import { responderLabel } from "@/utils/models";

const REASON_KEY: Record<FailureReason, string> = {
  rate_limited: "compare.fail.rateLimited",
  timeout: "compare.fail.timeout",
  empty_response: "compare.fail.emptyResponse",
  unavailable: "compare.fail.unavailable",
};

export default function CompareFailedCard({ failed }: { failed: FailedProvider }) {
  const { t } = useI18n();
  const { byokModelId, isOwnKey } = useKeys();

  // Show the model's real display name (PH17/B): a BYOK slot shows the user's
  // model_id, otherwise the registry label (Llama / GLM / DeepSeek), falling
  // back to the raw key for any provider not in the registry.
  const name = byokModelId(failed.provider) ?? responderLabel(failed.provider);

  // A rate-limit on the user's *own* key means their provider account is
  // exhausted — a distinct message from the app's shared-key rate limit
  // (PH18/8, D-13).
  const ownKeyRateLimited = failed.reason === "rate_limited" && isOwnKey(failed.provider);
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
