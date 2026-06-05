import { describe, expect, it } from "vitest";

import type { ChatDetail, ChatMessageRecord, SavedInteraction } from "@/types/api";

import { buildChatHistory, HISTORY_MAX_TURNS } from "./chatHistory";

function turn(id: number, user: string, best: string): ChatMessageRecord {
  return {
    id,
    created_at: "2026-06-05T00:00:00Z",
    payload: { user_message: user, best_response: best } as SavedInteraction,
  };
}

function chat(messages: ChatMessageRecord[]): ChatDetail {
  return {
    id: 1,
    title: "t",
    mode: "compare",
    model: null,
    created_at: "2026-06-05T00:00:00Z",
    updated_at: "2026-06-05T00:00:00Z",
    message_count: messages.length,
    messages,
  };
}

describe("buildChatHistory (P3/PH40)", () => {
  it("returns empty history for a new chat (no saved turns)", () => {
    expect(buildChatHistory(null)).toEqual([]);
    expect(buildChatHistory(chat([]))).toEqual([]);
  });

  it("maps each turn to user + assistant (the winning answer)", () => {
    const history = buildChatHistory(chat([turn(1, "hi", "hello"), turn(2, "more?", "sure")]));
    expect(history).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "more?" },
      { role: "assistant", content: "sure" },
    ]);
  });

  it("keeps only the last N turns", () => {
    const many = Array.from({ length: HISTORY_MAX_TURNS + 5 }, (_, i) =>
      turn(i + 1, `q${i}`, `a${i}`),
    );
    const history = buildChatHistory(chat(many));
    expect(history).toHaveLength(HISTORY_MAX_TURNS * 2);
    // Oldest surviving turn is the (total - N)th one; latest is the last.
    expect(history[0]).toEqual({ role: "user", content: "q5" });
    expect(history[history.length - 1]).toEqual({
      role: "assistant",
      content: `a${HISTORY_MAX_TURNS + 4}`,
    });
  });

  it("skips incomplete turns defensively", () => {
    const history = buildChatHistory(chat([turn(1, "q", ""), turn(2, "ok", "answer")]));
    expect(history).toEqual([
      { role: "user", content: "ok" },
      { role: "assistant", content: "answer" },
    ]);
  });
});
