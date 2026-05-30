// frontend/components/sidebar/ChatModeSelector.tsx

"use client";

import type { ReactNode } from "react";

import { IconChat, IconGrid } from "@/components/icons/Icons";
import { useChatMode, type ChatMode } from "@/store/ChatModeContext";
import { useI18n } from "@/store/LanguageContext";

export default function ChatModeSelector() {
  const { t } = useI18n();
  const { mode, setMode } = useChatMode();

  // RAG is no longer a mode (it's a composer toggle in both Single and Compare).
  const items: { value: ChatMode; label: string; icon: ReactNode }[] = [
    { value: "single", label: t("mode.single"), icon: <IconChat size={17} /> },
    { value: "compare", label: t("mode.compare"), icon: <IconGrid size={17} /> },
  ];

  return (
    <>
      <div className="sb-cap">{t("sidebar.chatMode")}</div>
      {items.map((item) => {
        const active = mode === item.value;
        return (
          <button
            key={item.value}
            className={active ? "sb-item sb-item--active" : "sb-item"}
            aria-pressed={active}
            onClick={() => setMode(item.value)}
          >
            <span className="sb-bar" />
            <span className="sb-ic">{item.icon}</span>
            <span className="sb-label">{item.label}</span>
          </button>
        );
      })}
    </>
  );
}
