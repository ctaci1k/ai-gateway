// frontend/store/KeysContext.tsx
//
// BYOK (bring-your-own-key) store (PH17, D-12). Holds the user's own API keys
// for the judge + up to 5 responders and the modal open state.
//
// SECURITY (NQ5): keys live ONLY in sessionStorage (cleared when the tab/window
// closes) and are sent transit-only in each request. They are never persisted
// server-side and never logged. On disk we keep nothing.
//
// A key is "active" once validated as working (a live test call succeeded on
// Save). Editing a key clears its active flag until re-validated. Only active
// entries are sent as overrides and counted as "on the user's own key".

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { validateKeys, type ValidateEntry, type ValidateResult } from "@/services/keysApi";

// Built-in responder slots (mirror the backend roster / models_config.py).
export const DEFAULT_RESPONDER_SLOTS = ["groq", "cerebras", "sambanova"] as const;
// The judge slot id (matches backend JUDGE_BYOK_SLOT).
export const JUDGE_SLOT = "byok-judge";
// Total responder cap including the 3 built-ins (NQ1): 3 default + up to 2 custom.
export const MAX_RESPONDERS = 5;

const STORAGE_KEY = "byok-keys-v1";

export interface ResponderKey {
  slot: string;
  baseUrl: string; // "" for default slots (endpoint fixed server-side)
  apiKey: string;
  modelId: string;
  custom: boolean; // a user-added 4th/5th slot (needs baseUrl)
  active: boolean; // validated working
}

export interface JudgeKey {
  apiKey: string;
  modelId: string;
  active: boolean;
}

export interface KeysState {
  judge: JudgeKey;
  responders: ResponderKey[];
}

// The transit payload sent in /chat and /chat/stream requests.
export interface ByokPayload {
  judge?: { base_url?: string; api_key: string; model_id: string };
  responders: { slot: string; base_url?: string; api_key: string; model_id: string }[];
}

function defaultState(): KeysState {
  return {
    judge: { apiKey: "", modelId: "", active: false },
    responders: DEFAULT_RESPONDER_SLOTS.map((slot) => ({
      slot,
      baseUrl: "",
      apiKey: "",
      modelId: "",
      custom: false,
      active: false,
    })),
  };
}

// Enforce the storage invariant on hydration (D-15): drop any custom (added) row
// that isn't active. Under the new save logic such rows never persist, but this
// also cleans up legacy sessionStorage written before PH20. Default slots and the
// judge are always kept. Pure for unit testing.
export function sanitizeLoadedState(state: KeysState): KeysState {
  return {
    judge: state.judge,
    responders: state.responders.filter((r) => !r.custom || r.active),
  };
}

function loadState(): KeysState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as KeysState;
    if (!parsed.judge || !Array.isArray(parsed.responders)) return defaultState();
    return sanitizeLoadedState(parsed);
  } catch {
    return defaultState();
  }
}

// Build the state to persist after validation (D-15): trim every field, set
// `active` from the validation results, and DROP custom (added) rows that aren't
// valid+working — an empty or invalid added model never reaches storage. Default
// slots and the judge are always kept (an empty default just means "use the
// built-in key"). Pure for unit testing.
export function buildPersistedState(
  draft: KeysState,
  bySlot: Record<string, ValidateResult>,
): KeysState {
  return {
    judge: {
      apiKey: draft.judge.apiKey.trim(),
      modelId: draft.judge.modelId.trim(),
      active: bySlot[JUDGE_SLOT]?.ok ?? false,
    },
    responders: draft.responders
      .filter((r) => !r.custom || (bySlot[r.slot]?.ok ?? false))
      .map((r) => ({
        ...r,
        apiKey: r.apiKey.trim(),
        modelId: r.modelId.trim(),
        baseUrl: r.baseUrl.trim(),
        active: bySlot[r.slot]?.ok ?? false,
      })),
  };
}

interface KeysValue {
  state: KeysState;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  // Validate every filled entry in the draft, persist it (active = working),
  // and return per-slot results so the modal can flag failing keys.
  saveAndValidate: (draft: KeysState) => Promise<Record<string, ValidateResult>>;
  // The transit overrides to attach to a chat request (null when none active).
  byokPayload: () => ByokPayload | null;
  // Active responder entries (own-key models) + judge state, for chips/labels.
  activeResponders: ResponderKey[];
  judgeActive: boolean;
  // Is this responder slot running on the user's own (active) key?
  isOwnKey: (slot: string) => boolean;
  // The user's model_id for an active slot (judge slot supported), else null.
  byokModelId: (slot: string) => string | null;
  // True when every Compare participant (the given responder slots + judge) is
  // on the user's own key → the turn is unlimited (NQ / Q7).
  allParticipantsOwn: (slots: string[]) => boolean;
}

const KeysContext = createContext<KeysValue | null>(null);

export function KeysProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KeysState>(defaultState);
  const [isOpen, setIsOpen] = useState(false);

  // Hydrate from sessionStorage after mount. Deferred a microtask so the first
  // client render still matches the server (empty) — no hydration mismatch —
  // then the stored keys are applied (mirrors AuthContext's async hydration).
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setState(loadState());
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: KeysState) => {
    setState(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const saveAndValidate = useCallback(
    async (draft: KeysState): Promise<Record<string, ValidateResult>> => {
      const entries: ValidateEntry[] = [];
      if (draft.judge.apiKey.trim() && draft.judge.modelId.trim()) {
        entries.push({
          slot: JUDGE_SLOT,
          api_key: draft.judge.apiKey.trim(),
          model_id: draft.judge.modelId.trim(),
          is_judge: true,
        });
      }
      for (const r of draft.responders) {
        if (!r.apiKey.trim() || !r.modelId.trim()) continue;
        entries.push({
          slot: r.slot,
          // Optional for default slots (PH22): empty → the built-in endpoint;
          // set → override (e.g. point AI 3 at another provider).
          base_url: r.baseUrl.trim() || undefined,
          api_key: r.apiKey.trim(),
          model_id: r.modelId.trim(),
        });
      }

      const results = entries.length ? await validateKeys(entries) : [];
      const bySlot: Record<string, ValidateResult> = {};
      for (const result of results) bySlot[result.slot] = result;

      // Persist trimmed state with active flags from validation. Custom (added)
      // rows that aren't valid+working are dropped (D-15) — invalid ones stay
      // visible/red only in the modal's local draft so a typo can be fixed.
      persist(buildPersistedState(draft, bySlot));
      return bySlot;
    },
    [persist],
  );

  const isOwnKey = useCallback(
    (slot: string) => state.responders.some((r) => r.slot === slot && r.active),
    [state],
  );

  const byokModelId = useCallback(
    (slot: string): string | null => {
      if (slot === JUDGE_SLOT) return state.judge.active ? state.judge.modelId : null;
      const found = state.responders.find((r) => r.slot === slot && r.active);
      return found ? found.modelId : null;
    },
    [state],
  );

  const byokPayload = useCallback((): ByokPayload | null => {
    const responders = state.responders
      .filter((r) => r.active)
      .map((r) => ({
        slot: r.slot,
        // Send any base_url the user set, incl. an override on a default slot.
        base_url: r.baseUrl || undefined,
        api_key: r.apiKey,
        model_id: r.modelId,
      }));
    const judge = state.judge.active
      ? { api_key: state.judge.apiKey, model_id: state.judge.modelId }
      : undefined;
    if (!responders.length && !judge) return null;
    return { judge, responders };
  }, [state]);

  const allParticipantsOwn = useCallback(
    (slots: string[]) =>
      slots.length > 0 && slots.every((slot) => isOwnKey(slot)) && state.judge.active,
    [isOwnKey, state],
  );

  const activeResponders = useMemo(() => state.responders.filter((r) => r.active), [state]);

  const value = useMemo<KeysValue>(
    () => ({
      state,
      isOpen,
      open,
      close,
      saveAndValidate,
      byokPayload,
      activeResponders,
      judgeActive: state.judge.active,
      isOwnKey,
      byokModelId,
      allParticipantsOwn,
    }),
    [
      state,
      isOpen,
      open,
      close,
      saveAndValidate,
      byokPayload,
      activeResponders,
      isOwnKey,
      byokModelId,
      allParticipantsOwn,
    ],
  );

  return <KeysContext.Provider value={value}>{children}</KeysContext.Provider>;
}

export function useKeys(): KeysValue {
  const context = useContext(KeysContext);
  if (!context) {
    throw new Error("useKeys must be used inside KeysProvider");
  }
  return context;
}
