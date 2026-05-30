// frontend/layouts/ChatLayout.tsx

"use client";

import type { ReactNode } from "react";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <div className="stage">{children}</div>;
}
