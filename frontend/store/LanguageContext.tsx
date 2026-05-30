// frontend/store/LanguageContext.tsx

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_LOCALE,
  LOCALES,
  createTranslator,
  isLocale,
  type LocaleCode,
  type LocaleMeta,
  type Translator,
} from "@/i18n";

const STORAGE_KEY = "ai-gateway.lang";

interface LanguageValue {
  t: Translator;
  lang: LocaleCode;
  setLang: (lang: LocaleCode) => void;
  locales: LocaleMeta[];
}

const LanguageContext = createContext<LanguageValue | null>(null);

function detectInitialLocale(): LocaleCode {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && isLocale(stored)) {
    return stored;
  }

  const browser = window.navigator.language?.slice(0, 2);
  if (browser && isLocale(browser)) {
    return browser;
  }

  return DEFAULT_LOCALE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<LocaleCode>(DEFAULT_LOCALE);

  // Initialise from storage/browser after mount (avoids SSR mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang(detectInitialLocale());
  }, []);

  // Persist + sync <html lang>.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageValue>(() => {
    const t = createTranslator(lang);
    return { t, lang, setLang, locales: LOCALES };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useI18n must be used inside LanguageProvider");
  }

  return context;
}
