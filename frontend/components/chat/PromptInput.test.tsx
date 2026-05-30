import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "@/store/LanguageContext";

import PromptInput from "./PromptInput";

function renderWithI18n(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe("PromptInput", () => {
  it("renders the translated placeholder", () => {
    renderWithI18n(<PromptInput placeholderKey="chat.placeholder" />);
    expect(screen.getByPlaceholderText("Type message...")).toBeTruthy();
  });

  it("fires onSubmit when the send button is clicked", () => {
    const onSubmit = vi.fn();
    renderWithI18n(<PromptInput onSubmit={onSubmit} placeholderKey="chat.placeholder" />);
    screen.getByLabelText("Send").click();
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
