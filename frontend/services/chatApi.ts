// frontend/services/chatApi.ts

import { apiFetch, ensureOk } from "@/services/apiClient";

export interface StreamChatParams {
  message: string;
  provider: string;
  // When true, the backend grounds the answer in the user's documents and
  // appends a terminal `sources` event to the stream (PH13/C3).
  ragEnabled?: boolean;
  // PH24 (D-17): when set, the Single turn is persisted into this saved chat.
  chatId?: number | null;
  // UI locale (PH33/B3b): fallback language for the response when the message
  // language is ambiguous. The model answers in the message language otherwise.
  locale?: string;
}

// Single mode: returns the streaming Response (NDJSON) for the caller to read.
// BYOK keys are loaded server-side from storage (PH30, D-20) — not sent here.
export async function streamChat({
  message,
  provider,
  ragEnabled = false,
  chatId = null,
  locale,
}: StreamChatParams): Promise<Response> {
  const response = await apiFetch("/chat/stream", {
    method: "POST",
    body: {
      message,
      provider,
      rag_enabled: ragEnabled,
      ...(chatId != null ? { chat_id: chatId } : {}),
      ...(locale ? { locale } : {}),
    },
  });
  return ensureOk(response);
}
