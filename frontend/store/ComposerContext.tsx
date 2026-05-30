// frontend/store/ComposerContext.tsx
//
// Composer-level UI state shared across Single and Compare (PH13):
//   - singleProvider: which responder Single streams from (B1).
// RAG is no longer a manual toggle — it is applied automatically whenever the
// user has uploaded documents (derived from RagContext in the chat hooks), so
// there is nothing to store here for it.

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Responder models available for Single (mirrors the backend responder set).
export const SINGLE_PROVIDERS = ["groq", "cerebras", "sambanova"] as const;
export type SingleProvider = (typeof SINGLE_PROVIDERS)[number];

interface ComposerValue {
  singleProvider: SingleProvider;
  setSingleProvider: (provider: SingleProvider) => void;
}

const ComposerContext = createContext<ComposerValue | null>(null);

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [singleProvider, setSingleProvider] = useState<SingleProvider>("groq");

  const value = useMemo<ComposerValue>(
    () => ({ singleProvider, setSingleProvider }),
    [singleProvider],
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useComposer(): ComposerValue {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error("useComposer must be used inside ComposerProvider");
  }
  return context;
}
