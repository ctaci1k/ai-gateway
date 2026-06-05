// frontend/utils/chatHistory.ts
//
// Assemble transient in-chat dialogue history (P3/PH40) from a saved chat's
// persisted turns, so responders remember earlier context within THIS chat.
// Shared by Single (ComposerContext) and Compare (useCompare) — one place, no
// duplication. The backend clamps + truncates again defensively (routes/chat.py).

import type { ChatDetail, ChatTurn } from "@/types/api";

// Max prior turns of context sent along. Mirrors the backend cap; keeping it
// small here also trims the request body. A "turn" → one user + one assistant
// message.
export const HISTORY_MAX_TURNS = 10;

// Build history from the saved thread: each persisted turn yields the user's
// message and the assistant's WINNING answer (`best_response` — the judged best
// in Compare, the model's reply in Single; both store the same field). Only the
// last N turns ride along; a new chat with no saved turns → empty (fresh
// context). Incomplete turns (missing text) are skipped defensively.
export function buildChatHistory(chat: ChatDetail | null): ChatTurn[] {
  if (!chat) return [];
  const turns: ChatTurn[] = [];
  for (const { payload } of chat.messages.slice(-HISTORY_MAX_TURNS)) {
    const user = payload.user_message?.trim();
    const assistant = payload.best_response?.trim();
    if (!user || !assistant) continue;
    turns.push({ role: "user", content: user });
    turns.push({ role: "assistant", content: assistant });
  }
  return turns;
}
