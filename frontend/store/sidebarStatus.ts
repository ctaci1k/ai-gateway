// frontend/store/sidebarStatus.ts
//
// Single source of truth for the sidebar status indicators (PH23/D1). Derives
// the BYOK key state and the account-limit state from the existing contexts so
// that BOTH presentations stay in sync without duplicated logic:
//   - expanded: the full banners (KeysStatusBanner + LimitBanner),
//   - collapsed rail: the compact colored squares (StatusSquares).
//
// Tones map to design tokens in the components: ok → success/green,
// warn → danger/red (a partial Compare set), and the limited account → danger.

"use client";

import { useAuth } from "@/store/AuthContext";
import { useChatMode } from "@/store/ChatModeContext";
import { useComposer } from "@/store/ComposerContext";
import { DEFAULT_RESPONDER_SLOTS, JUDGE_SLOT, useKeys } from "@/store/KeysContext";

export type ByokStatus =
  | { tone: "ok"; kind: "single"; model: string }
  | { tone: "ok"; kind: "compareAll" }
  | { tone: "warn"; kind: "comparePartial" }
  | null;

export interface SidebarStatus {
  // BYOK key state for the active mode (null when the user has no active own key).
  byok: ByokStatus;
  // The account is a non-admin with at least one request limit (per-minute/day).
  limited: boolean;
}

export function useSidebarStatus(): SidebarStatus {
  const { mode } = useChatMode();
  const { singleProvider } = useComposer();
  const { isOwnKey, judgeActive, byokModelId, activeResponders, allParticipantsOwn } = useKeys();
  const { user } = useAuth();

  // Any own key active? (derived from server metadata, PH30 — no transit payload).
  const hasActiveKey = activeResponders.length > 0 || judgeActive;

  let byok: ByokStatus = null;
  if (mode === "single" && singleProvider) {
    const onOwnKey = singleProvider === JUDGE_SLOT ? judgeActive : isOwnKey(singleProvider);
    if (onOwnKey) byok = { tone: "ok", kind: "single", model: byokModelId(singleProvider) ?? "" };
  } else if (mode === "compare" && hasActiveKey) {
    // Compare: green only when every participant (responders + judge) is own-key.
    const customSlots = activeResponders.filter((r) => r.custom).map((r) => r.slot);
    const slots = [...DEFAULT_RESPONDER_SLOTS, ...customSlots];
    byok = allParticipantsOwn(slots)
      ? { tone: "ok", kind: "compareAll" }
      : { tone: "warn", kind: "comparePartial" };
  }

  const limited = Boolean(
    user &&
    !user.is_admin &&
    (user.max_requests_per_minute != null || user.max_requests_per_day != null),
  );

  return { byok, limited };
}
