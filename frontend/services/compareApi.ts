// frontend/services/compareApi.ts

import { apiFetch, parseJsonResponse } from "@/services/apiClient";
import type { ChatResponse, ChatTurn } from "@/types/api";

export interface CompareChatParams {
  message: string;
  providers: string[];
  selectorEnabled: boolean;
  // When set, the turn is persisted into this saved chat (PH9).
  chatId?: number | null;
  // Ground all responders in the user's documents (PH13/C1).
  ragEnabled?: boolean;
  // UI locale (PH33/B3b): fallback language for responses when the message
  // language is ambiguous.
  locale?: string;
  // Prior turns of THIS chat (Compare → the winning answer per turn) so
  // responders remember context (P3/PH40). Empty for a new chat; backend clamps.
  history?: ChatTurn[];
}

// BYOK keys are loaded server-side from storage (PH30, D-20) — not sent here.
export async function compareChat({
  message,
  providers,
  selectorEnabled,
  chatId = null,
  ragEnabled = false,
  locale,
  history,
}: CompareChatParams): Promise<ChatResponse> {
  const response = await apiFetch("/chat", {
    method: "POST",
    body: {
      message,
      providers,
      compare_mode: true,
      selector_enabled: selectorEnabled,
      chat_id: chatId,
      rag_enabled: ragEnabled,
      ...(locale ? { locale } : {}),
      ...(history && history.length ? { history } : {}),
    },
  });
  return parseJsonResponse<ChatResponse>(response);
}
