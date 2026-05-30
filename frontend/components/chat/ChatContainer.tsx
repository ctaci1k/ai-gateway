// frontend/components/chat/ChatContainer.tsx

"use client";

import type { ReactNode } from "react";

export default function ChatContainer({ children }: { children: ReactNode }) {
  return <section className="chat">{children}</section>;
}
