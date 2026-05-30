// frontend/services/chatsApi.ts
//
// Typed CRUD for saved Compare chats (PH9). All requests go through the shared
// apiClient (cookies + CSRF); components never call fetch directly.

import { apiFetch, parseJsonResponse } from "@/services/apiClient";
import type { ChatDetail, ChatSummary } from "@/types/api";

interface ChatListResponse {
  chats: ChatSummary[];
}

export async function listChats(): Promise<ChatSummary[]> {
  const response = await apiFetch("/chats");
  const data = await parseJsonResponse<ChatListResponse>(response);
  return data.chats;
}

export async function createChat(title?: string): Promise<ChatDetail> {
  const response = await apiFetch("/chats", {
    method: "POST",
    body: { title: title ?? null },
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
