// frontend/components/chat/MessageScroll.tsx
//
// Shared scroll container for the chat/compare feed (PH18/5). Wraps the single
// `.msgs` scroll region and overlays a centered "scroll to bottom" button that
// appears only when the user has scrolled up. Behaviour:
//   - sticks to the bottom while content grows (streaming tokens, new turns),
//     but only when the user is already pinned to the bottom — reading history
//     is never interrupted;
//   - a new prompt (scrollSignal change) pins the just-sent QUESTION to the TOP
//     of the feed (P2/M2), so answers grow below it from the first line instead
//     of dragging the question off-screen.
// Used by both Single (ChatPage) and Compare (ComparePage) so the logic lives in
// one place.

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { IconChevron } from "@/components/icons/Icons";
import { useI18n } from "@/store/LanguageContext";

interface MessageScrollProps {
  children: ReactNode;
  // Increments when the user submits a new prompt → pin the new question to the
  // top once it lands, even if they had scrolled away.
  scrollSignal?: number;
}

// A few px of slack so "near the bottom" still counts as pinned.
const BOTTOM_THRESHOLD = 24;

// Both Single (MessageBubble) and Compare (CompareTurn → MessageBubble) render
// the user's question with this class, so it identifies a "question" block in
// either feed without the pages having to thread refs down.
const QUESTION_SELECTOR = ".msg-user";

export default function MessageScroll({ children, scrollSignal = 0 }: MessageScrollProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Mirror for observer callbacks so they don't need to re-subscribe on change.
  const atBottomRef = useRef(true);
  // P2: a pending request to pin the next question to the top, plus the question
  // element we last anchored. We anchor only when the *last* question is a NEW
  // element — that's how we tell the just-sent question apart from the previous
  // one (Single commits it in the same batch; Compare after the network round-
  // trip), without reading the DOM during render.
  const wantTopAnchorRef = useRef(false);
  const lastQuestionRef = useRef<HTMLElement | null>(null);

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

  // If a top-anchor is pending and the newest question is an element we haven't
  // anchored yet, bring its top edge to the top of the scroll region. After this
  // the user is no longer pinned to the bottom, so streaming tokens grow below
  // the question instead of yanking it away. Returns nothing; idempotent.
  const tryAnchorQuestion = useCallback((smooth: boolean) => {
    if (!wantTopAnchorRef.current) return;
    const el = ref.current;
    if (!el) return;
    const questions = el.querySelectorAll<HTMLElement>(QUESTION_SELECTOR);
    const last = questions[questions.length - 1];
    // No question yet, or still the previous one (new turn not committed) → wait.
    if (!last || last === lastQuestionRef.current) return;
    lastQuestionRef.current = last;
    wantTopAnchorRef.current = false;
    const top = el.scrollTop + (last.getBoundingClientRect().top - el.getBoundingClientRect().top);
    el.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    atBottomRef.current = false;
    setAtBottom(false);
  }, []);

  // A new prompt was submitted → request the anchor and try right away (covers
  // Single, where the optimistic question is already committed). If it isn't in
  // the DOM yet (Compare), the observer below anchors it once it arrives.
  useLayoutEffect(() => {
    if (scrollSignal === 0) return;
    wantTopAnchorRef.current = true;
    tryAnchorQuestion(true);
  }, [scrollSignal, tryAnchorQuestion]);

  // React to content growth: pin the pending question once it lands, otherwise
  // keep the bottom sticky only while already pinned.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new MutationObserver(() => {
      if (wantTopAnchorRef.current) {
        tryAnchorQuestion(true);
        if (!wantTopAnchorRef.current) return; // anchored this round
      }
      if (atBottomRef.current) scrollToBottom(false);
      else measure();
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [measure, scrollToBottom, tryAnchorQuestion]);

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
