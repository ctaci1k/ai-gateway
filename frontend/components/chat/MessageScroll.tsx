// frontend/components/chat/MessageScroll.tsx
//
// Shared scroll container for the chat/compare feed (PH18/5). Wraps the single
// `.msgs` scroll region and overlays a centered "scroll to bottom" button that
// appears only when the user has scrolled up. Behaviour:
//   - sticks to the bottom while content grows (streaming tokens, new turns),
//     but only when the user is already pinned to the bottom — reading history
//     is never interrupted;
//   - a new prompt (scrollSignal change) always jumps back to the latest message.
// Used by both Single (ChatPage) and Compare (ComparePage) so the logic lives in
// one place.

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { IconChevron } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

interface MessageScrollProps {
  children: ReactNode;
  // Increments when the user submits a new prompt → force-scroll to the bottom
  // even if they had scrolled up.
  scrollSignal?: number;
}

// A few px of slack so "near the bottom" still counts as pinned.
const BOTTOM_THRESHOLD = 24;

export default function MessageScroll({ children, scrollSignal = 0 }: MessageScrollProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Mirror for observer callbacks so they don't need to re-subscribe on change.
  const atBottomRef = useRef(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const next = distance <= BOTTOM_THRESHOLD;
    atBottomRef.current = next;
    setAtBottom(next);
  }, []);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Keep pinned to the bottom as content grows, but only when already pinned.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new MutationObserver(() => {
      if (atBottomRef.current) scrollToBottom(false);
      else measure();
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [measure, scrollToBottom]);

  // A new prompt was submitted → always return to the latest message. The
  // resulting smooth scroll fires scroll events that refresh `atBottom` (and
  // hide the button); pinning the ref keeps the observer sticking meanwhile.
  useEffect(() => {
    if (scrollSignal === 0) return;
    atBottomRef.current = true;
    scrollToBottom(true);
  }, [scrollSignal, scrollToBottom]);

  return (
    <div className="msgs-wrap">
      <div className="msgs" ref={ref} onScroll={measure}>
        {children}
      </div>
      {!atBottom && (
        <button
          type="button"
          className="scroll-bottom"
          onClick={() => scrollToBottom(true)}
          aria-label={t("chat.scrollToBottom")}
        >
          <IconChevron size={18} />
        </button>
      )}
    </div>
  );
}
