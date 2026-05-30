// frontend/components/compare/CompareColumn.tsx

"use client";

import { useI18n } from "@/store/LanguageContext";

import ManualSelectionButton from "./ManualSelectionButton";
import ModelScoreCard from "./ModelScoreCard";

interface CompareColumnProps {
  provider: string;
  model: string;
  response: string;
  score: number;
  executionTime: number;
  winner: boolean;
  selected: boolean;
  fallback?: boolean;
  judgeName?: string | null;
  onSelect: () => void;
}

export default function CompareColumn({
  provider,
  model,
  response,
  score,
  executionTime,
  winner,
  selected,
  fallback = false,
  judgeName = null,
  onSelect,
}: CompareColumnProps) {
  const { t } = useI18n();

  return (
    <div className={winner ? "rcard rcard-win" : "rcard"}>
      {winner && <div className="rcard-flag">{t("compare.bestAnswer")}</div>}

      <div className="rcard-head">
        <div>
          <div className="rcard-name">{provider.toUpperCase()}</div>
          <div className="rcard-model mono">{model}</div>
        </div>
        <ModelScoreCard score={score} executionTime={executionTime} />
      </div>

      <div className="score-bar">
        <span style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>

      <p className="rcard-text">{response}</p>

      <ManualSelectionButton
        winner={winner}
        selected={selected}
        fallback={fallback}
        judgeName={judgeName}
        onSelect={onSelect}
      />
    </div>
  );
}
