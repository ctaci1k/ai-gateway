// frontend/components/compare/CompareColumn.tsx

"use client";

import { useI18n } from "@/store/LanguageContext";
import { modelDisplay } from "@/utils/models";

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
  // PH32 (D-22): key source of this slot on the SAVED turn (self-describing).
  isByok?: boolean;
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
  isByok = false,
  fallback = false,
  judgeName = null,
  onSelect,
}: CompareColumnProps) {
  const { t } = useI18n();

  // Truthful name (PH32, D-22): a replayed historical card reads the key source
  // FROM THE SAVED TURN (isByok) + the real model, never the current keys —
  // built-in → friendly slot label; own key → the real model id.
  const name = modelDisplay(provider, model, isByok);

  return (
    <div className={winner ? "rcard rcard-win" : "rcard"}>
      {winner && <div className="rcard-flag">{t("compare.bestAnswer")}</div>}

      <div className="rcard-head">
        <div>
          <div className="rcard-name">{name}</div>
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
