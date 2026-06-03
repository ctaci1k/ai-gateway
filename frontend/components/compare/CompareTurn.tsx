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
  const winnerSlot = metadata.selected_model ?? interaction.selected_model ?? null;
  // PH32 (D-22): the REAL winning model from the SAVED turn — self-describing, so
  // the banner shows the truth on replay (built-in → slot label; own key → the
  // real model) without consulting the current keys.
  const winner = winnerSlot ? interaction.all_responses?.[winnerSlot] : undefined;

  return (
    <div className="compare-turn">
      <MessageBubble role="user" content={interaction.user_message} />

      <SelectorBanner
        selectedModel={winnerSlot}
        selectorModel={metadata.selector_model}
        winnerModel={winner?.model}
        winnerIsByok={winner?.is_byok}
        confidence={metadata.selector_confidence}
        fallback={metadata.fallback_used}
        fallbackReason={metadata.fallback_reason}
      />

      <CompareModal
        responses={rows}
        failedProviders={interaction.failed_providers || []}
        selectedModel={selectedModel}
        winnerModel={winnerSlot}
        judgeModel={metadata.selector_model}
        fallback={metadata.fallback_used}
        onSelect={onSelect}
      />
    </div>
  );
}
