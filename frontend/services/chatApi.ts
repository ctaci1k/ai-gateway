// frontend/services/chatApi.ts

import { apiFetch, ensureOk } from "@/services/apiClient";

export interface StreamChatParams {
  message: string;
  provider: string;
  // When true, the backend grounds the answer in the user's documents and
  // appends a terminal `sources` event to the stream (PH13/C3).
  ragEnabled?: boolean;
}

// Single mode: returns the streaming Response (NDJSON) for the caller to read.
export async function streamChat({
  message,
  provider,
  ragEnabled = false,
}: StreamChatParams): Promise<Response> {
  const response = await apiFetch("/chat/stream", {
    method: "POST",
    body: { message, provider, rag_enabled: ragEnabled },
  });
  return ensureOk(response);
}
