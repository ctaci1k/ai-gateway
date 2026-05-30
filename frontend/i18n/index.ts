// frontend/i18n/index.ts
//
// Tiny i18n engine: dictionaries per locale + a translator with {var}
// interpolation and fallback (locale → default → key).

import en from "./messages/en.json";
import pl from "./messages/pl.json";
import uk from "./messages/uk.json";

export type LocaleCode = "uk" | "pl" | "en";

export type Messages = Record<string, string>;

export const DEFAULT_LOCALE: LocaleCode = "en";

export const dictionaries: Record<LocaleCode, Messages> = { uk, pl, en };

export interface LocaleMeta {
  code: LocaleCode;
  label: string;
}

// Order shown in the language switcher.
export const LOCALES: LocaleMeta[] = [
  { code: "en", label: "EN" },
  { code: "pl", label: "PL" },
  { code: "uk", label: "UA" },
];

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

export function createTranslator(locale: LocaleCode): Translator {
  const primary = dictionaries[locale] ?? {};
  const fallback = dictionaries[DEFAULT_LOCALE];

  return (key, vars) => {
    const template = primary[key] ?? fallback[key] ?? key;
    return interpolate(template, vars);
  };
}

export function isLocale(value: string): value is LocaleCode {
  return value === "uk" || value === "pl" || value === "en";
}
