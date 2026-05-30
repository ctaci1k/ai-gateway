// frontend/store/ChatModeContext.tsx

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// RAG is no longer a standalone mode (PH13/C4) — it is a toggle in the composer
// available within both Single and Compare.
export type ChatMode = "single" | "compare";

interface ChatModeValue {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
}

const ChatModeContext = createContext<ChatModeValue | null>(null);

export function ChatModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ChatMode>("single");

  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return <ChatModeContext.Provider value={value}>{children}</ChatModeContext.Provider>;
}

export function useChatMode(): ChatModeValue {
  const context = useContext(ChatModeContext);

  if (!context) {
    throw new Error("useChatMode must be used inside ChatModeProvider");
  }

  return context;
}
