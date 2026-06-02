// frontend/utils/chatTitle.ts
//
// A new chat is titled after its first message (PH16/F3, PH24). Shared by Single
// and Compare so the rule lives in one place. The backend clamps to 255 chars;
// we keep the sidebar label tidy at a shorter bound.

const TITLE_MAX_LEN = 60;

export function deriveChatTitle(message: string): string {
  const clean = message.trim().replace(/\s+/g, " ");
  return clean.length > TITLE_MAX_LEN ? `${clean.slice(0, TITLE_MAX_LEN)}…` : clean;
}
