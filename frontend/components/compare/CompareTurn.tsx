// frontend/components/compare/CompareTurn.tsx
//
// One turn of a saved Compare chat thread (PH13/A1): the user's question, the
// judge banner for *that* turn (showing its persisted fallback state — D3), and
// the per-model comparison. Manual re-selection trains personalization.

"use client";

import MessageBubble from "@/components/chat/MessageBubble";
import CompareModal from "@/components/compare/CompareModal";
import SelectorBanner from "@/components/selector/SelectorBanner";
import { toCompareRows } from "@/features/compare/rows";
import type { SavedInteraction } from "@/types/api";

interface CompareTurnProps {
  interaction: SavedInteraction;
  selectedModel: string | null;
  onSelect: (provider: string) => void;
}

export default function CompareTurn({ interaction, selectedModel, onSelect }: CompareTurnProps) {
  const metadata = interaction.selector_metadata || {};
  const rows = toCompareRows(
    interaction.all_responses,
    interaction.selector_scores,
    metadata.selector_confidence || 0,
  );
  const winnerModel = metadata.selected_model ?? interaction.selected_model ?? null;

  return (
    <div className="compare-turn">
      <MessageBubble role="user" content={interaction.user_message} />

      <SelectorBanner
        selectedModel={winnerModel}
        selectorModel={metadata.selector_model}
        confidence={metadata.selector_confidence}
        fallback={metadata.fallback_used}
        fallbackReason={metadata.fallback_reason}
      />

      <CompareModal
        responses={rows}
        failedProviders={interaction.failed_providers || []}
        selectedModel={selectedModel}
        winnerModel={winnerModel}
        judgeModel={metadata.selector_model}
        fallback={metadata.fallback_used}
        onSelect={onSelect}
      />
    </div>
  );
}
