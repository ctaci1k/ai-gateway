// frontend/store/ComingSoonContext.tsx
//
// Tiny shared state for the "in development" stub modal (PH24, F1). Several
// triggers (Profile & Avatar, Security — in the account menu; Reports — for
// every user) open the same modal with a different topic.

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ComingSoonTopic = "profile" | "security" | "reports";

interface ComingSoonValue {
  topic: ComingSoonTopic | null;
  open: (topic: ComingSoonTopic) => void;
  close: () => void;
}

const ComingSoonContext = createContext<ComingSoonValue | null>(null);

export function ComingSoonProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState<ComingSoonTopic | null>(null);

  const value = useMemo<ComingSoonValue>(
    () => ({
      topic,
      open: (next: ComingSoonTopic) => setTopic(next),
      close: () => setTopic(null),
    }),
    [topic],
  );

  return <ComingSoonContext.Provider value={value}>{children}</ComingSoonContext.Provider>;
}

export function useComingSoon(): ComingSoonValue {
  const context = useContext(ComingSoonContext);
  if (!context) {
    throw new Error("useComingSoon must be used inside ComingSoonProvider");
  }
  return context;
}
