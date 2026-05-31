// frontend/components/compare/CompareColumn.tsx

"use client";

import { useKeys } from "@/store/KeysContext";
import { useI18n } from "@/store/LanguageContext";
import { RESPONDER_LABELS } from "@/utils/models";

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
  const { byokModelId } = useKeys();

  // Truthful name (PH23/A1): when this slot runs on the user's own key — including
  // an *overridden* default slot (e.g. sambanova pointed at another provider) —
  // show the entered model_id, mirroring CompareFailedCard. Otherwise a built-in
  // slot shows its friendly registry label, falling back to model_id / provider.
  const name = byokModelId(provider) ?? RESPONDER_LABELS[provider] ?? model ?? provider;

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
