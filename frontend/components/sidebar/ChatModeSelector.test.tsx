import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatModeProvider } from "@/store/ChatModeContext";
import { LanguageProvider } from "@/store/LanguageContext";

import ChatModeSelector from "./ChatModeSelector";

describe("ChatModeSelector", () => {
  it("renders the Single and Compare modes (RAG is no longer a mode)", () => {
    render(
      <LanguageProvider>
        <ChatModeProvider>
          <ChatModeSelector />
        </ChatModeProvider>
      </LanguageProvider>,
    );
    expect(screen.getByText("Single Chat")).toBeTruthy();
    expect(screen.getByText("Compare Mode")).toBeTruthy();
    expect(screen.queryByText("Documents (RAG)")).toBeNull();
  });
});
