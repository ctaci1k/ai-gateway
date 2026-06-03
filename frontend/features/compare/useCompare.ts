// frontend/features/compare/useCompare.ts

"use client";

import { useCallback, useState } from "react";

import { compareChat } from "@/services/compareApi";
import { DEFAULT_RESPONDER_SLOTS, useKeys } from "@/store/KeysContext";
import { useRagDocuments } from "@/store/RagContext";

export interface RunCompareOptions {
  chatId?: number | null;
}

export interface UseCompareResult {
  loading: boolean;
  error: string | null;
  runCompare: (message: string, options?: RunCompareOptions) => Promise<void>;
}

// Runs one Compare turn. The result is persisted server-side against the chat
// (chatId) and rendered from the reloaded thread (PH16/D1), so the hook only
// owns the request lifecycle (loading / error) — it no longer stores responses.
export function useCompare(): UseCompareResult {
  // RAG is applied automatically whenever the user has any documents.
  const { documents } = useRagDocuments();
  const ragEnabled = documents.length > 0;
  // BYOK: extra (custom) responders the user added expand the Compare roster to
  // 4–5 columns. Keys are loaded server-side from storage (PH30, D-20) — no
  // longer sent in the request; only the slot list rides along.
  const { activeResponders } = useKeys();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCompare = useCallback(
    async (message: string, options: RunCompareOptions = {}) => {
      if (!message?.trim()) {
        return;
      }

      setError(null);
      setLoading(true);

      // The 3 built-in slots plus any active custom responder slots (deduped).
      const customSlots = activeResponders.filter((r) => r.custom).map((r) => r.slot);
      const providers = [...DEFAULT_RESPONDER_SLOTS, ...customSlots];

      try {
        await compareChat({
          message,
          providers,
          selectorEnabled: true,
          chatId: options.chatId ?? null,
          ragEnabled,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [ragEnabled, activeResponders],
  );

  return { loading, error, runCompare };
}
