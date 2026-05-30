import { describe, expect, it } from "vitest";

import { createTranslator, dictionaries, LOCALES } from "./index";

describe("i18n createTranslator", () => {
  it("translates known keys for the active locale", () => {
    const t = createTranslator("en");
    expect(t("chat.send")).toBe("Send");
    expect(t("mode.compare")).toBe("Compare Mode");
  });

  it("interpolates {vars}", () => {
    const t = createTranslator("en");
    expect(t("chat.messages", { count: 3 })).toContain("3");
  });

  it("falls back to the key when missing everywhere", () => {
    const t = createTranslator("en");
    expect(t("totally.unknown.key")).toBe("totally.unknown.key");
  });

  it("keeps all locales at key parity", () => {
    const keys = (code: (typeof LOCALES)[number]["code"]) => Object.keys(dictionaries[code]).sort();
    const en = keys("en");
    for (const { code } of LOCALES) {
      expect(keys(code)).toEqual(en);
    }
  });
});
