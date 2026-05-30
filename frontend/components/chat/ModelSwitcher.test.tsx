import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComposerProvider } from "@/store/ComposerContext";
import { LanguageProvider } from "@/store/LanguageContext";

import ModelSwitcher from "./ModelSwitcher";

function renderSwitcher() {
  return render(
    <LanguageProvider>
      <ComposerProvider>
        <ModelSwitcher />
      </ComposerProvider>
    </LanguageProvider>,
  );
}

describe("ModelSwitcher", () => {
  it("renders the three responder choices with groq active by default", () => {
    renderSwitcher();
    const groq = screen.getByRole("button", { name: "groq" });
    expect(groq.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "cerebras" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "sambanova" })).toBeTruthy();
  });

  it("switches the active provider on click", () => {
    renderSwitcher();
    const cerebras = screen.getByRole("button", { name: "cerebras" });
    fireEvent.click(cerebras);
    expect(cerebras.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "groq" }).getAttribute("aria-pressed")).toBe("false");
  });
});
