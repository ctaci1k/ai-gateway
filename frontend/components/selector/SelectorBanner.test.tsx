import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LanguageProvider } from "@/store/LanguageContext";

import SelectorBanner from "./SelectorBanner";

function renderWithI18n(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe("SelectorBanner", () => {
  it("shows a neutral judge label and the real model name (D-9)", () => {
    renderWithI18n(
      <SelectorBanner selectedModel="groq" selectorModel="qwen/qwen3-32b" confidence={0.82} />,
    );
    expect(screen.getByText(/AI Judge \(Qwen\)/)).toBeTruthy();
    expect(screen.getByText(/0\.82/)).toBeTruthy();
    expect(screen.queryByText(/Gemini/)).toBeNull();
  });

  it("names the real winning model on an own key, not the slot label (PH32)", () => {
    renderWithI18n(
      <SelectorBanner
        selectedModel="groq"
        selectorModel="qwen/qwen3-32b"
        winnerModel="gpt-4o"
        winnerIsByok
        confidence={0.9}
      />,
    );
    // The slot is "groq" but the user's own key answered with gpt-4o.
    expect(screen.getByText(/gpt-4o/)).toBeTruthy();
    expect(screen.queryByText(/Llama 3.3 70B/)).toBeNull();
  });

  it("shows the friendly slot label for a built-in winner (PH32)", () => {
    renderWithI18n(
      <SelectorBanner selectedModel="groq" selectorModel="qwen/qwen3-32b" winnerModel="m" />,
    );
    // Not BYOK → the friendly slot label, never the raw built-in model id.
    expect(screen.getByText(/Llama 3.3 70B/)).toBeTruthy();
  });

  it("shows the concrete fallback reason (D1)", () => {
    renderWithI18n(<SelectorBanner fallback fallbackReason="low_confidence" />);
    expect(screen.getByText(/confidence was below the threshold/i)).toBeTruthy();
  });

  it("falls back to generic wording when no reason is given", () => {
    renderWithI18n(<SelectorBanner fallback />);
    expect(screen.getByText(/evaluated by fallback script/i)).toBeTruthy();
  });
});
