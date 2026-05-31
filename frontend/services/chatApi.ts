// frontend/services/chatApi.ts

import { apiFetch, ensureOk } from "@/services/apiClient";
import type { ByokPayload } from "@/store/KeysContext";

export interface StreamChatParams {
  message: string;
  provider: string;
  // When true, the backend grounds the answer in the user's documents and
  // appends a terminal `sources` event to the stream (PH13/C3).
  ragEnabled?: boolean;
  // Transit-only BYOK overrides (PH17); omitted when the user has no own keys.
  byok?: ByokPayload | null;
}

// Single mode: returns the streaming Response (NDJSON) for the caller to read.
export async function streamChat({
  message,
  provider,
  ragEnabled = false,
  byok = null,
}: StreamChatParams): Promise<Response> {
  const response = await apiFetch("/chat/stream", {
    method: "POST",
    body: { message, provider, rag_enabled: ragEnabled, ...(byok ? { byok } : {}) },
  });
  return ensureOk(response);
}
