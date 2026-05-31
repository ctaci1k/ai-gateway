// frontend/store/KeysContext.test.ts
//
// Unit tests for the pure BYOK state helpers (PH20, D-15): only valid+working
// custom (added) models survive into storage; empty/invalid ones are dropped.

import { describe, expect, it } from "vitest";

import type { ValidateResult } from "@/services/keysApi";
import {
  JUDGE_SLOT,
  buildPersistedState,
  sanitizeLoadedState,
  type KeysState,
} from "@/store/KeysContext";

function baseDraft(): KeysState {
  return {
    judge: { apiKey: " jk ", modelId: " jm ", active: false },
    responders: [
      { slot: "groq", baseUrl: "", apiKey: "gk", modelId: "gm", custom: false, active: false },
      { slot: "cerebras", baseUrl: "", apiKey: "", modelId: "", custom: false, active: false },
      { slot: "sambanova", baseUrl: "", apiKey: "", modelId: "", custom: false, active: false },
      {
        slot: "custom-ok",
        baseUrl: " https://x/v1 ",
        apiKey: "ck",
        modelId: "cm",
        custom: true,
        active: false,
      },
      {
        slot: "custom-bad",
        baseUrl: "https://y/v1",
        apiKey: "bad",
        modelId: "bad",
        custom: true,
        active: false,
      },
      {
        slot: "custom-empty",
        baseUrl: "",
        apiKey: "",
        modelId: "",
        custom: true,
        active: false,
      },
    ],
  };
}

const okResults: Record<string, ValidateResult> = {
  groq: { slot: "groq", ok: true },
  [JUDGE_SLOT]: { slot: JUDGE_SLOT, ok: true },
  "custom-ok": { slot: "custom-ok", ok: true },
  "custom-bad": { slot: "custom-bad", ok: false, error: "nope" },
};

describe("buildPersistedState", () => {
  it("keeps default slots + valid custom, drops invalid/empty custom (D-15)", () => {
    const next = buildPersistedState(baseDraft(), okResults);
    const slots = next.responders.map((r) => r.slot);

    // Three default slots always kept; only the valid custom survives.
    expect(slots).toEqual(["groq", "cerebras", "sambanova", "custom-ok"]);
    expect(slots).not.toContain("custom-bad");
    expect(slots).not.toContain("custom-empty");
  });

  it("sets active flags from validation and trims fields", () => {
    const next = buildPersistedState(baseDraft(), okResults);
    expect(next.judge).toEqual({ apiKey: "jk", modelId: "jm", active: true });

    const groq = next.responders.find((r) => r.slot === "groq")!;
    expect(groq.active).toBe(true);
    const cerebras = next.responders.find((r) => r.slot === "cerebras")!;
    expect(cerebras.active).toBe(false);
    const custom = next.responders.find((r) => r.slot === "custom-ok")!;
    expect(custom.active).toBe(true);
    expect(custom.baseUrl).toBe("https://x/v1");
  });

  it("drops every custom row when none validate", () => {
    const next = buildPersistedState(baseDraft(), {});
    expect(next.responders.map((r) => r.slot)).toEqual(["groq", "cerebras", "sambanova"]);
    expect(next.judge.active).toBe(false);
  });
});

describe("sanitizeLoadedState", () => {
  it("drops legacy custom rows that aren't active, keeps defaults + active custom", () => {
    const stored: KeysState = {
      judge: { apiKey: "jk", modelId: "jm", active: true },
      responders: [
        { slot: "groq", baseUrl: "", apiKey: "", modelId: "", custom: false, active: false },
        {
          slot: "custom-live",
          baseUrl: "https://x/v1",
          apiKey: "k",
          modelId: "m",
          custom: true,
          active: true,
        },
        {
          slot: "custom-stale",
          baseUrl: "https://y/v1",
          apiKey: "k",
          modelId: "m",
          custom: true,
          active: false,
        },
      ],
    };
    const clean = sanitizeLoadedState(stored);
    expect(clean.responders.map((r) => r.slot)).toEqual(["groq", "custom-live"]);
    expect(clean.judge.active).toBe(true);
  });
});
