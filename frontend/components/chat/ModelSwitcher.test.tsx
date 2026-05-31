import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthProvider } from "@/store/AuthContext";
import { ComposerProvider } from "@/store/ComposerContext";
import { KeysProvider } from "@/store/KeysContext";
import { LanguageProvider } from "@/store/LanguageContext";
import { RagProvider } from "@/store/RagContext";
import { responderLabel } from "@/utils/models";

import ModelSwitcher from "./ModelSwitcher";

// ComposerProvider derives RAG state from RagContext, which needs AuthContext;
// with no session the auth probe simply settles anonymous (no document fetch).
// ModelSwitcher + ComposerProvider also read BYOK state from KeysContext.
function renderSwitcher() {
  return render(
    <LanguageProvider>
      <AuthProvider>
        <KeysProvider>
          <RagProvider>
            <ComposerProvider>
              <ModelSwitcher />
            </ComposerProvider>
          </RagProvider>
        </KeysProvider>
      </AuthProvider>
    </LanguageProvider>,
  );
}

describe("ModelSwitcher", () => {
  it("renders the three responder choices (truthful labels) with groq active by default", () => {
    renderSwitcher();
    const groq = screen.getByRole("button", { name: responderLabel("groq") });
    expect(groq.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: responderLabel("cerebras") })).toBeTruthy();
    expect(screen.getByRole("button", { name: responderLabel("sambanova") })).toBeTruthy();
  });

  it("switches the active provider on click", () => {
    renderSwitcher();
    const cerebras = screen.getByRole("button", { name: responderLabel("cerebras") });
    fireEvent.click(cerebras);
    expect(cerebras.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: responderLabel("groq") }).getAttribute("aria-pressed"),
    ).toBe("false");
  });
});
