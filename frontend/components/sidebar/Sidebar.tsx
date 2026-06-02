// frontend/components/sidebar/Sidebar.tsx
//
// Classic Console sidebar (PH24, A3): two collapsible groups — Single Models and
// Compare — each with "+ New Chat" and a nested History list of that mode's
// saved chats; a creator card is pinned at the bottom. Settings / Admin / theme
// / language live in the topbar now, not here.
//
// Mobile (PH23, kept): the sidebar becomes an off-canvas drawer opened by the
// topbar burger — focus-trapped, Esc-closable, and closed after navigation.

"use client";

import { useEffect, useRef, useState } from "react";

import { IconGrid, IconModels } from "@/components/icons/Icons";
import { useChatMode } from "@/store/ChatModeContext";
import { useChats } from "@/store/ChatsContext";
import { useComposer } from "@/store/ComposerContext";
import { useI18n } from "@/store/LanguageContext";
import { useSidebar } from "@/store/SidebarContext";
import type { ChatSummary } from "@/types/api";

import AccordionSection from "./AccordionSection";
import CreatorCard from "./CreatorCard";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Refresh relative timestamps roughly every 30s without re-rendering on every
// frame; cheap and keeps "N min ago" honest.
const TICK_MS = 30_000;

export default function Sidebar() {
  const { t } = useI18n();
  const { mode, setMode } = useChatMode();
  const {
    singleChats,
    compareChats,
    activeChatId,
    selectChat,
    newChat,
    loading,
    error,
    rename,
    remove,
    notice,
  } = useChats();
  const { openSingle } = useComposer();
  const { mobileOpen, closeMobile } = useSidebar();

  // Independent accordions (cc default: Single open, Compare collapsed); either
  // can be expanded without closing the other.
  const [singleOpen, setSingleOpen] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);
  const [histSingleOpen, setHistSingleOpen] = useState(true);
  const [histCompareOpen, setHistCompareOpen] = useState(true);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const asideRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Mobile drawer a11y (PH23): trap Tab while open, Esc closes, restore focus.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const aside = asideRef.current;
    const focusables = () =>
      aside
        ? Array.from(aside.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
    focusables()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [mobileOpen, closeMobile]);

  // Close the drawer after navigating (mode / chat changes).
  const firstNav = useRef(true);
  useEffect(() => {
    if (firstNav.current) {
      firstNav.current = false;
      return;
    }
    closeMobile();
  }, [mode, activeChatId, closeMobile]);

  // --- handlers ---
  function newSingle() {
    setMode("single");
    setSingleOpen(true);
    void newChat(); // clears active chat → draft
    openSingle(null); // → model picker
  }

  function newCompare() {
    setMode("compare");
    setCompareOpen(true);
    void newChat();
  }

  function pickSingle(chat: ChatSummary) {
    setMode("single");
    void selectChat(chat.id);
    openSingle(chat.model); // bind composer to this chat's fixed model
  }

  function pickCompare(chat: ChatSummary) {
    setMode("compare");
    void selectChat(chat.id);
  }

  const limitNotice = notice ? (
    <div className="cc-newchat-notice" role="status">
      {t(notice, { limit: 25 })}
    </div>
  ) : null;

  const className = ["cc-side", mobileOpen ? "cc-side--mobile-open" : ""].filter(Boolean).join(" ");

  return (
    <aside ref={asideRef} className={className} aria-label={t("sidebar.label")}>
      <div className="cc-side-scroll thin-scroll">
        <AccordionSection
          icon={<IconModels size={17} />}
          label={t("sidebar.singleTitle")}
          sub={t("sidebar.singleSub")}
          open={singleOpen}
          onToggle={() => setSingleOpen((o) => !o)}
          newChatLabel={t("chat.new")}
          onNewChat={newSingle}
          chats={singleChats}
          activeChatId={mode === "single" ? activeChatId : null}
          loading={loading}
          error={error}
          histOpen={histSingleOpen}
          onHistToggle={() => setHistSingleOpen((o) => !o)}
          nowMs={nowMs}
          notice={mode === "single" ? limitNotice : null}
          onPickChat={pickSingle}
          onRename={rename}
          onRemove={remove}
        />
        <AccordionSection
          icon={<IconGrid size={17} />}
          label={t("sidebar.compareTitle")}
          sub={t("sidebar.compareSub")}
          open={compareOpen}
          onToggle={() => setCompareOpen((o) => !o)}
          newChatLabel={t("chat.new")}
          onNewChat={newCompare}
          chats={compareChats}
          activeChatId={mode === "compare" ? activeChatId : null}
          loading={loading}
          error={error}
          histOpen={histCompareOpen}
          onHistToggle={() => setHistCompareOpen((o) => !o)}
          nowMs={nowMs}
          notice={mode === "compare" ? limitNotice : null}
          onPickChat={pickCompare}
          onRename={rename}
          onRemove={remove}
        />
      </div>

      <CreatorCard />
    </aside>
  );
}
