// frontend/features/compare/rows.ts
//
// Shared mapping from a backend response / persisted turn to the CompareRow
// view model, used by both the live run (useCompare) and the saved thread
// (CompareTurn) so the shape lives in exactly one place.

import type { CompareRow, ProviderResponse } from "@/types/api";

export function toCompareRows(
  allResponses: Record<string, Pick<ProviderResponse, "model" | "response" | "execution_time">>,
  scores: Record<string, number> | undefined,
  confidence: number,
): CompareRow[] {
  return Object.entries(allResponses || {}).map(([provider, item]) => ({
    provider,
    model: item.model,
    response: item.response,
    executionTime: item.execution_time,
    score: scores?.[provider] || 0,
    confidence,
  }));
}
