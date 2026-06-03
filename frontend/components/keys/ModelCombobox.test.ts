import { describe, expect, it } from "vitest";

import { dedupeModels } from "./ModelCombobox";

describe("dedupeModels", () => {
  it("keeps the first occurrence of duplicate ids", () => {
    const out = dedupeModels([
      { id: "llama-3.3-70b", is_chat: true },
      { id: "mixtral", is_chat: true },
      { id: "llama-3.3-70b", is_chat: false },
    ]);
    expect(out.map((m) => m.id)).toEqual(["llama-3.3-70b", "mixtral"]);
    // first occurrence wins → keeps is_chat: true
    expect(out[0].is_chat).toBe(true);
  });

  it("normalizes by trim + case-insensitive id", () => {
    const out = dedupeModels([
      { id: "GPT-4o", is_chat: true },
      { id: " gpt-4o ", is_chat: true },
      { id: "gpt-4o", is_chat: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("GPT-4o");
  });

  it("drops empty/whitespace-only ids", () => {
    const out = dedupeModels([
      { id: "", is_chat: true },
      { id: "   ", is_chat: true },
      { id: "real-model", is_chat: true },
    ]);
    expect(out.map((m) => m.id)).toEqual(["real-model"]);
  });

  it("returns an empty array unchanged", () => {
    expect(dedupeModels([])).toEqual([]);
  });
});
