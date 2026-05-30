// frontend/components/compare/CompareModal.tsx

"use client";

import { IconGrid } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";
import type { CompareRow, FailedProvider } from "@/types/api";
import { judgeModelName } from "@/utils/judge";

import CompareColumn from "./CompareColumn";
import CompareFailedCard from "./CompareFailedCard";

interface CompareModalProps {
  responses?: CompareRow[];
  failedProviders?: FailedProvider[];
  selectedModel?: string | null;
  winnerModel?: string | null;
  // The judge model id (selector_metadata.selector_model); drives the friendly
  // label on the winner card (D-9).
  judgeModel?: string | null;
  fallback?: boolean;
  onSelect?: (provider: string) => void;
}

export default function CompareModal({
  responses = [],
  failedProviders = [],
  selectedModel = null,
  winnerModel = null,
  judgeModel = null,
  fallback = false,
  onSelect = () => {},
}: CompareModalProps) {
  const { t } = useI18n();
  const judgeName = judgeModelName(judgeModel);

  return (
    <div className="responses">
      <div className="responses-head">
        <div className="responses-title">
          <IconGrid size={18} />
          <span>{t("compare.title")}</span>
        </div>
      </div>

      <div className="modal-grid">
        {responses.map((row) => (
          <CompareColumn
            key={row.provider}
            provider={row.provider}
            model={row.model}
            response={row.response}
            score={row.score}
            executionTime={row.executionTime}
            winner={row.provider === winnerModel}
            selected={row.provider === selectedModel}
            fallback={fallback}
            judgeName={judgeName}
            onSelect={() => onSelect(row.provider)}
          />
        ))}
        {failedProviders.map((failed) => (
          <CompareFailedCard key={`fail-${failed.provider}`} failed={failed} />
        ))}
      </div>
    </div>
  );
}
