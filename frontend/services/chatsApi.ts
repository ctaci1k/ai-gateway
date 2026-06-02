// frontend/services/chatsApi.ts
//
// Typed CRUD for saved Compare chats (PH9). All requests go through the shared
// apiClient (cookies + CSRF); components never call fetch directly.

import { apiFetch, parseJsonResponse } from "@/services/apiClient";
import type { ChatDetail, ChatMode, ChatSummary } from "@/types/api";

interface ChatListResponse {
  chats: ChatSummary[];
}

// PH24: chats are mode-aware. `mode` filters the list to Single or Compare
// chats; omit it to list all.
export async function listChats(mode?: ChatMode): Promise<ChatSummary[]> {
  const path = mode ? `/chats?mode=${mode}` : "/chats";
  const response = await apiFetch(path);
  const data = await parseJsonResponse<ChatListResponse>(response);
  return data.chats;
}

export interface CreateChatParams {
  title?: string;
  mode?: ChatMode;
  // The fixed responder slot for a Single chat (ignored for Compare).
  model?: string | null;
}

export async function createChat({
  title,
  mode = "compare",
  model = null,
}: CreateChatParams = {}): Promise<ChatDetail> {
  const response = await apiFetch("/chats", {
    method: "POST",
    body: { title: title ?? null, mode, model },
  });
  return parseJsonResponse<ChatDetail>(response);
}

export async function getChat(chatId: number): Promise<ChatDetail> {
  const response = await apiFetch(`/chats/${chatId}`);
  return parseJsonResponse<ChatDetail>(response);
}

export async function renameChat(chatId: number, title: string): Promise<ChatSummary> {
  const response = await apiFetch(`/chats/${chatId}`, {
    method: "PATCH",
    body: { title },
  });
  return parseJsonResponse<ChatSummary>(response);
}

export async function deleteChat(chatId: number): Promise<void> {
  const response = await apiFetch(`/chats/${chatId}`, { method: "DELETE" });
  await parseJsonResponse<{ message: string }>(response);
}
