// frontend/store/ReportsContext.tsx
//
// Open/close state for the Usage Reports modal (PH27, D-18). The account menu's
// "Reports" item opens it; the modal closes itself. Mirrors SettingsContext.
//
// `targetUserId` supports the admin bonus (G): when set, the modal shows that
// user's report under an admin-gated surface; null/undefined = the current user.

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface ReportsTarget {
  userId: number;
  username: string;
}

interface ReportsValue {
  isOpen: boolean;
  target: ReportsTarget | null;
  open: (target?: ReportsTarget) => void;
  close: () => void;
}

const ReportsContext = createContext<ReportsValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<ReportsTarget | null>(null);

  const value = useMemo<ReportsValue>(
    () => ({
      isOpen,
      target,
      open: (next?: ReportsTarget) => {
        setTarget(next ?? null);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [isOpen, target],
  );

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports(): ReportsValue {
  const context = useContext(ReportsContext);
  if (!context) {
    throw new Error("useReports must be used inside ReportsProvider");
  }
  return context;
}
