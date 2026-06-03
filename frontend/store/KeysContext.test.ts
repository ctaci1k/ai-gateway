// frontend/store/KeysContext.test.ts
//
// Unit tests for the pure BYOK state helpers under the PH30 (D-20) server-side,
// write-only model: metadata → editor state, and the incomplete-row guards that
// block Save (PH29.2 preserved, now "stored"-aware).

import { describe, expect, it } from "vitest";

import type { KeyMeta } from "@/services/keysApi";
import {
  JUDGE_SLOT,
  findIncompleteSlots,
  isBuiltinIncomplete,
  isCustomIncomplete,
  stateFromMetadata,
  type DraftState,
} from "@/store/KeysContext";

describe("stateFromMetadata", () => {
  it("always yields the 3 built-in slots (unstored when absent) + judge", () => {
    const state = stateFromMetadata([]);
    expect(state.responders.map((r) => r.slot)).toEqual(["groq", "cerebras", "sambanova"]);
    expect(state.responders.every((r) => !r.stored && !r.custom)).toBe(true);
    expect(state.judge.stored).toBe(false);
  });

  it("maps stored metadata (model/base/last4) and marks slots stored", () => {
    const keys: KeyMeta[] = [
      { slot: "groq", base_url: "", model_id: "my-llama", last4: "1234", custom: false },
      {
        slot: JUDGE_SLOT,
        base_url: "https://api.openai.com/v1",
        model_id: "gpt-4o",
        last4: "9999",
        custom: false,
      },
      {
        slot: "custom-x",
        base_url: "https://x/v1",
        model_id: "m",
        last4: "abcd",
        custom: true,
      },
    ];
    const state = stateFromMetadata(keys);

    const groq = state.responders.find((r) => r.slot === "groq")!;
    expect(groq.stored).toBe(true);
    expect(groq.modelId).toBe("my-llama");
    expect(groq.last4).toBe("1234");

    expect(state.judge.stored).toBe(true);
    expect(state.judge.baseUrl).toBe("https://api.openai.com/v1");
    expect(state.judge.modelId).toBe("gpt-4o");

    const custom = state.responders.find((r) => r.slot === "custom-x")!;
    expect(custom).toBeDefined();
    expect(custom.custom).toBe(true);
    expect(custom.stored).toBe(true);
  });
});

describe("isBuiltinIncomplete (stored-aware)", () => {
  it("a fully-empty, unstored slot is fine", () => {
    expect(isBuiltinIncomplete("", "", "", false)).toBe(false);
  });

  it("a stored slot with a prefilled model (no typed key) is complete", () => {
    expect(isBuiltinIncomplete("", "", "my-llama", true)).toBe(false);
  });

  it("an endpoint override with no key+model is incomplete", () => {
    expect(isBuiltinIncomplete("https://api.openai.com/v1", "", "", false)).toBe(true);
  });

  it("a typed key without a model is incomplete", () => {
    expect(isBuiltinIncomplete("", "sk-x", "", false)).toBe(true);
  });

  it("a model without a key (and not stored) is incomplete", () => {
    expect(isBuiltinIncomplete("", "", "m", false)).toBe(true);
  });
});

describe("isCustomIncomplete (stored-aware)", () => {
  it("requires endpoint + model + (key or stored)", () => {
    expect(isCustomIncomplete("https://x/v1", "k", "m", false)).toBe(false);
    expect(isCustomIncomplete("https://x/v1", "", "m", true)).toBe(false);
    // missing endpoint
    expect(isCustomIncomplete("", "k", "m", false)).toBe(true);
    // missing key and not stored
    expect(isCustomIncomplete("https://x/v1", "", "m", false)).toBe(true);
  });
});

describe("findIncompleteSlots", () => {
  function draft(over: Partial<DraftState>): DraftState {
    return {
      judge: { baseUrl: "", apiKey: "", modelId: "", last4: "", stored: false },
      responders: [
        {
          slot: "groq",
          baseUrl: "",
          apiKey: "",
          modelId: "",
          last4: "",
          custom: false,
          stored: false,
        },
      ],
      ...over,
    };
  }

  it("treats fully-empty rows as fine", () => {
    expect(findIncompleteSlots(draft({}))).toEqual([]);
  });

  it("flags a default slot with an endpoint override but no key+model", () => {
    const d = draft({
      responders: [
        {
          slot: "groq",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "",
          modelId: "",
          last4: "",
          custom: false,
          stored: false,
        },
      ],
    });
    expect(findIncompleteSlots(d)).toEqual(["groq"]);
  });

  it("flags the judge when only one of key/model is set", () => {
    const d = draft({
      judge: { baseUrl: "", apiKey: "k", modelId: "", last4: "", stored: false },
    });
    expect(findIncompleteSlots(d)).toEqual([JUDGE_SLOT]);
  });

  it("does not flag a stored slot being edited only on its model", () => {
    const d = draft({
      responders: [
        {
          slot: "groq",
          baseUrl: "",
          apiKey: "",
          modelId: "new-model",
          last4: "1234",
          custom: false,
          stored: true,
        },
      ],
    });
    expect(findIncompleteSlots(d)).toEqual([]);
  });

  it("flags a custom slot missing the endpoint", () => {
    const d = draft({
      responders: [
        {
          slot: "c1",
          baseUrl: "",
          apiKey: "k",
          modelId: "m",
          last4: "",
          custom: true,
          stored: false,
        },
      ],
    });
    expect(findIncompleteSlots(d)).toEqual(["c1"]);
  });
});
