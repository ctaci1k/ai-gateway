// frontend/store/ThemeContext.tsx

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_THEME, THEMES, type ThemeName } from "@/theme/tokens";

const STORAGE_KEY = "ai-gateway.theme";

interface ThemeValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  themes: ThemeName[];
}

const ThemeContext = createContext<ThemeValue | null>(null);

function detectInitialTheme(): ThemeName {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);

  // Read persisted theme after mount: keeps the first client render identical
  // to SSR (default), avoiding hydration mismatches, then syncs to storage.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(detectInitialTheme());
  }, []);

  // Single source of truth: write data-theme on <html> + persist.
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      themes: THEMES,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
