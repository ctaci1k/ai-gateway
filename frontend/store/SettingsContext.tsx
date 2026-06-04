// frontend/store/SettingsContext.tsx
//
// Open/close state for the Settings modal (PH24, E1). The topbar gear button and
// the account menu's "Account settings" item open it; the modal closes itself.
// `section` lets a trigger deep-link to a specific section (e.g. API Keys).

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type SettingsSection = "judge" | "keys" | "language";

interface SettingsValue {
  isOpen: boolean;
  section: SettingsSection;
  open: (section?: SettingsSection) => void;
  setSection: (section: SettingsSection) => void;
  close: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("judge");

  const value = useMemo<SettingsValue>(
    () => ({
      isOpen,
      section,
      open: (next?: SettingsSection) => {
        if (next) setSection(next);
        setIsOpen(true);
      },
      setSection,
      close: () => setIsOpen(false),
    }),
    [isOpen, section],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return context;
}
