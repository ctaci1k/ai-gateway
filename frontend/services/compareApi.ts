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
}

export async function compareChat({
  message,
  providers,
  selectorEnabled,
  chatId = null,
  ragEnabled = false,
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
    },
  });
  return parseJsonResponse<ChatResponse>(response);
}
