// frontend/components/compare/ModelScoreCard.tsx

"use client";

import { useI18n } from "@/store/LanguageContext";

interface ModelScoreCardProps {
  score?: number;
  executionTime?: number;
}

export default function ModelScoreCard({ score = 0, executionTime = 0 }: ModelScoreCardProps) {
  const { t } = useI18n();

  return (
    <div className="stats">
      <div className="stats-row">
        <span>{t("score.time")}</span>
        <b className="mono">{executionTime}s</b>
      </div>
      <div className="stats-row">
        <span>{t("score.score")}</span>
        <b className="mono">
          {score}
          <i>/100</i>
        </b>
      </div>
    </div>
  );
}
