// frontend/services/compareApi.ts

import { apiFetch, parseJsonResponse } from "@/services/apiClient";
import type { ChatResponse } from "@/types/api";

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
}

// BYOK keys are loaded server-side from storage (PH30, D-20) — not sent here.
export async function compareChat({
  message,
  providers,
  selectorEnabled,
  chatId = null,
  ragEnabled = false,
  locale,
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
    },
  });
  return parseJsonResponse<ChatResponse>(response);
}
