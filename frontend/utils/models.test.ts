import { describe, expect, it } from "vitest";

import { modelDisplay, responderLabel } from "./models";

describe("modelDisplay (PH32, D-22)", () => {
  it("shows the friendly slot label for a built-in slot (not BYOK)", () => {
    // The real model is irrelevant when the turn ran on the app's built-in key.
    expect(modelDisplay("groq", "llama-3.3-70b-versatile", false)).toBe("Llama 3.3 70B");
    expect(modelDisplay("mistral", null, false)).toBe("Mistral Small");
    expect(modelDisplay("scout", null, false)).toBe("Llama 4 Scout");
  });

  it("survives a legacy slot retired by PH35/PH36 (cerebras/sambanova/nvidia/gemini)", () => {
    // The retired slot is no longer in RESPONDER_LABELS; a historical row falls
    // back to the stored real model when present, else the raw slot — no crash.
    expect(modelDisplay("cerebras", "GLM-4.7", true)).toBe("GLM-4.7");
    expect(responderLabel("sambanova")).toBe("sambanova");
    expect(responderLabel("gemini")).toBe("gemini");
  });

  it("shows the real model id when the slot ran on the user's own key", () => {
    // The core fix: an own key on a built-in slot must not show the slot's label.
    expect(modelDisplay("groq", "gpt-4o", true)).toBe("gpt-4o");
  });

  it("falls back to the slot label for a legacy own-key row without a real model", () => {
    // key_fingerprint set but model_name null (pre-PH32 own-key row).
    expect(modelDisplay("groq", null, true)).toBe(responderLabel("groq"));
  });

  it("falls back to the real model then an em-dash when there is no slot", () => {
    expect(modelDisplay(null, "gpt-4o", true)).toBe("gpt-4o");
    expect(modelDisplay(null, null, false)).toBe("—");
  });
});
