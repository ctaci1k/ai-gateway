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

  it("shows the concrete fallback reason (D1)", () => {
    renderWithI18n(<SelectorBanner fallback fallbackReason="low_confidence" />);
    expect(screen.getByText(/confidence was below the threshold/i)).toBeTruthy();
  });

  it("falls back to generic wording when no reason is given", () => {
    renderWithI18n(<SelectorBanner fallback />);
    expect(screen.getByText(/evaluated by fallback script/i)).toBeTruthy();
  });
});
