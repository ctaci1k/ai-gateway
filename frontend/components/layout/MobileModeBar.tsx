// frontend/components/layout/MobileModeBar.tsx
//
// Mobile-only mode bar (PH37/M3). Replaces both the burger drawer and the flat
// ModeSwitch buttons on phones (≤768px): two side-by-side "column dropdowns" —
// Single Models and Compare — each opening a popover that mirrors the desktop
// sidebar accordion (icon + title + sub trigger; "+ New Chat" + History list
// inside). Desktop is untouched: this block is `display:none` ≥769px (see
// components.css).
//
// No duplicated logic: data + handlers come from the shared useChatNav hook (the
// same the sidebar uses), and the popover body reuses <AccordionSection headless>.

"use client";

import Dropdown from "@/components/common/Dropdown";
import { IconChevron, IconGrid, IconModels } from "@/components/icons/Icons";
import AccordionSection from "@/components/sidebar/AccordionSection";
import { useI18n } from "@/store/LanguageContext";
import { useChatNav } from "@/store/useChatNav";
import { useState, type ReactNode } from "react";
import type { ChatSummary } from "@/types/api";

interface Column {
  key: "single" | "compare";
  icon: ReactNode;
  title: string;
  sub: string;
  chats: ChatSummary[];
  activeChatId: number | null;
  notice: ReactNode;
  onNewChat: () => void;
  onPickChat: (chat: ChatSummary) => void;
  histOpen: boolean;
  onHistToggle: () => void;
}

export default function MobileModeBar() {
  const { t } = useI18n();
  const nav = useChatNav();

  // History sub-section open state, per column (independent of the dropdown's
  // own open/close). Both open by default so saved chats are visible at a glance.
  const [histSingleOpen, setHistSingleOpen] = useState(true);
  const [histCompareOpen, setHistCompareOpen] = useState(true);

  const columns: Column[] = [
    {
      key: "single",
      icon: <IconModels size={17} />,
      title: t("sidebar.singleTitle"),
      sub: t("sidebar.singleSub"),
      chats: nav.singleChats,
      activeChatId: nav.singleActiveId,
      notice: nav.singleNotice,
      onNewChat: nav.newSingle,
      onPickChat: nav.pickSingle,
      histOpen: histSingleOpen,
      onHistToggle: () => setHistSingleOpen((o) => !o),
    },
    {
      key: "compare",
      icon: <IconGrid size={17} />,
      title: t("sidebar.compareTitle"),
      sub: t("sidebar.compareSub"),
      chats: nav.compareChats,
      activeChatId: nav.compareActiveId,
      notice: nav.compareNotice,
      onNewChat: nav.newCompare,
      onPickChat: nav.pickCompare,
      histOpen: histCompareOpen,
      onHistToggle: () => setHistCompareOpen((o) => !o),
    },
  ];

  return (
    <div className="cc-mmbar" role="group" aria-label={t("sidebar.label")}>
      {columns.map((col) => (
        <Dropdown
          key={col.key}
          label={col.title}
          align="left"
          className="cc-mmbar-col"
          renderTrigger={(open, toggle) => (
            <button
              type="button"
              className={open ? "cc-mmbar-trigger is-open" : "cc-mmbar-trigger"}
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="ic">{col.icon}</span>
              <span className="lab">
                {col.title}
                <small>{col.sub}</small>
              </span>
              <IconChevron size={16} className="chev" />
            </button>
          )}
        >
          {(close) => (
            <AccordionSection
              headless
              icon={col.icon}
              label={col.title}
              sub={col.sub}
              open
              onToggle={() => {}}
              newChatLabel={t("chat.new")}
              onNewChat={() => {
                col.onNewChat();
                close();
              }}
              chats={col.chats}
              activeChatId={col.activeChatId}
              loading={nav.loading}
              error={nav.error}
              histOpen={col.histOpen}
              onHistToggle={col.onHistToggle}
              nowMs={nav.nowMs}
              notice={col.notice}
              onPickChat={(chat) => {
                col.onPickChat(chat);
                close();
              }}
              onRename={nav.rename}
              onRemove={nav.remove}
            />
          )}
        </Dropdown>
      ))}
    </div>
  );
}
