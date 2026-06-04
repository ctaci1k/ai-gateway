// frontend/store/KeysContext.tsx
//
// BYOK (bring-your-own-key) store. PH30 (D-20) moved keys to server-side
// ENCRYPTED, per-account storage (reversing D-12's sessionStorage + transit):
//
//   - The store holds WRITE-ONLY metadata hydrated from the server
//     (slot / base_url / model_id / last4 / custom) — never the key itself.
//   - On login it hydrates via GET /keys; switching account re-hydrates; logout
//     clears the local cache (the server keeps each account's keys, isolated by
//     user_id). No sessionStorage, no transit of keys in chat requests.
//   - Saving goes through PUT /keys (the server validates with a live call and
//     stores only working ones); a slot present in the metadata is therefore an
//     active, validated own key. "Clear"/"Remove" calls DELETE /keys/{slot}.

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

import {
  deleteKey,
  getKeys,
  putKeys,
  type KeyMeta,
  type SaveEntry,
  type SaveResult,
} from "@/services/keysApi";
import { useAuth } from "@/store/AuthContext";

// Built-in responder slots (mirror the backend roster / models_config.py).
export const DEFAULT_RESPONDER_SLOTS = ["groq", "mistral", "scout"] as const;
// The judge slot id (matches backend JUDGE_BYOK_SLOT).
export const JUDGE_SLOT = "byok-judge";
// Total responder cap including the 3 built-ins (NQ1): 3 default + up to 2 custom.
export const MAX_RESPONDERS = 5;

// A responder slot as known from server metadata. `stored` = a working key is
// saved server-side for it (the key plaintext never reaches the client).
export interface ResponderKey {
  slot: string;
  baseUrl: string; // "" = built-in endpoint (default slots) / unset
  modelId: string;
  last4: string; // last 4 chars of the stored key (write-only mask), "" if none
  custom: boolean; // a user-added 4th/5th slot
  stored: boolean; // has a validated key on the server
}

export interface JudgeKey {
  baseUrl: string; // "" = built-in judge endpoint (Groq)
  modelId: string;
  last4: string;
  stored: boolean;
}

export interface KeysState {
  judge: JudgeKey;
  responders: ResponderKey[];
}

// Build the derived editor state from server metadata: always the 3 built-in
// responder slots (in order) + any stored custom slots, plus the judge. A slot
// without metadata is shown empty (uses the app's built-in key). Pure.
export function stateFromMetadata(keys: KeyMeta[]): KeysState {
  const bySlot = new Map(keys.map((k) => [k.slot, k]));

  const judgeMeta = bySlot.get(JUDGE_SLOT);
  const judge: JudgeKey = judgeMeta
    ? {
        baseUrl: judgeMeta.base_url ?? "",
        modelId: judgeMeta.model_id ?? "",
        last4: judgeMeta.last4 ?? "",
        stored: true,
      }
    : { baseUrl: "", modelId: "", last4: "", stored: false };

  const responders: ResponderKey[] = DEFAULT_RESPONDER_SLOTS.map((slot) => {
    const meta = bySlot.get(slot);
    return {
      slot,
      baseUrl: meta?.base_url ?? "",
      modelId: meta?.model_id ?? "",
      last4: meta?.last4 ?? "",
      custom: false,
      stored: Boolean(meta),
    };
  });

  // Any stored custom slots (anything that isn't a default responder or judge).
  for (const k of keys) {
    if (k.slot === JUDGE_SLOT || DEFAULT_RESPONDER_SLOTS.includes(k.slot as never)) {
      continue;
    }
    responders.push({
      slot: k.slot,
      baseUrl: k.base_url ?? "",
      modelId: k.model_id ?? "",
      last4: k.last4 ?? "",
      custom: true,
      stored: true,
    });
  }

  return { judge, responders };
}

// A built-in slot (judge / default AI 1/2/3) is half-filled: something is set
// but it isn't a complete, usable override. Base URL is optional (empty =
// built-in endpoint). Complete = a model id AND a key (either typed now or
// already stored). A fully-empty, not-stored slot is fine. Pure.
export function isBuiltinIncomplete(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  stored: boolean,
): boolean {
  const filled = baseUrl.trim() !== "" || apiKey.trim() !== "" || modelId.trim() !== "" || stored;
  const complete = modelId.trim() !== "" && (apiKey.trim() !== "" || stored);
  return filled && !complete;
}

// A custom slot (AI 4/5) must point at a concrete endpoint: base URL + model +
// a key (typed now or already stored). Pure.
export function isCustomIncomplete(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  stored: boolean,
): boolean {
  const filled = baseUrl.trim() !== "" || apiKey.trim() !== "" || modelId.trim() !== "" || stored;
  const complete =
    baseUrl.trim() !== "" && modelId.trim() !== "" && (apiKey.trim() !== "" || stored);
  return filled && !complete;
}

// A row in the form draft (mirrors KeysState rows + the freshly-typed apiKey).
export interface DraftResponder extends ResponderKey {
  apiKey: string;
}
export interface DraftJudge extends JudgeKey {
  apiKey: string;
}
export interface DraftState {
  judge: DraftJudge;
  responders: DraftResponder[];
}

// Slot ids of rows that are partially filled and must be rejected on Save (the
// judge is reported as JUDGE_SLOT). Fully-empty rows are fine and excluded. Pure.
export function findIncompleteSlots(draft: DraftState): string[] {
  const slots: string[] = [];
  if (
    isBuiltinIncomplete(
      draft.judge.baseUrl,
      draft.judge.apiKey,
      draft.judge.modelId,
      draft.judge.stored,
    )
  ) {
    slots.push(JUDGE_SLOT);
  }
  for (const r of draft.responders) {
    const incomplete = r.custom
      ? isCustomIncomplete(r.baseUrl, r.apiKey, r.modelId, r.stored)
      : isBuiltinIncomplete(r.baseUrl, r.apiKey, r.modelId, r.stored);
    if (incomplete) slots.push(r.slot);
  }
  return slots;
}

interface KeysValue {
  state: KeysState;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  // Validate + store the given entries server-side; returns per-slot results.
  saveKeys: (entries: SaveEntry[]) => Promise<SaveResult[]>;
  // Delete a stored slot (Clear/Remove) and refresh local metadata.
  removeKey: (slot: string) => Promise<void>;
  // Active responder entries (own-key models) + judge state, for chips/labels.
  activeResponders: ResponderKey[];
  judgeActive: boolean;
  // Is this responder slot running on the user's own (stored) key?
  isOwnKey: (slot: string) => boolean;
  // The user's model_id for a stored slot (judge slot supported), else null.
  byokModelId: (slot: string) => string | null;
  // True when every Compare participant (the given responder slots + judge) is
  // on the user's own key → the turn is unlimited (NQ / Q7).
  allParticipantsOwn: (slots: string[]) => boolean;
}

const KeysContext = createContext<KeysValue | null>(null);

export function KeysProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<KeyMeta[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user, status } = useAuth();
  const userId = user?.id ?? null;

  // Hydrate metadata from the server per account (PH30, D-20). On login or an
  // account switch, fetch this user's stored keys; on logout / anonymous, drop
  // the local cache (the server keeps each account's keys, isolated by user_id).
  // setKeys is only called from async callbacks (never synchronously in the
  // effect body) to avoid cascading renders.
  useEffect(() => {
    if (status === "loading") return undefined;
    let active = true;
    if (status === "authenticated" && userId != null) {
      getKeys()
        .then((k) => {
          if (active) setKeys(k);
        })
        .catch(() => {
          if (active) setKeys([]);
        });
    } else {
      Promise.resolve().then(() => {
        if (active) setKeys([]);
      });
    }
    return () => {
      active = false;
    };
  }, [status, userId]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const saveKeys = useCallback(async (entries: SaveEntry[]): Promise<SaveResult[]> => {
    const response = await putKeys(entries);
    setKeys(response.keys);
    return response.results;
  }, []);

  const removeKey = useCallback(async (slot: string) => {
    const remaining = await deleteKey(slot);
    setKeys(remaining);
  }, []);

  const state = useMemo(() => stateFromMetadata(keys), [keys]);

  const isOwnKey = useCallback(
    (slot: string) => state.responders.some((r) => r.slot === slot && r.stored),
    [state],
  );

  const byokModelId = useCallback(
    (slot: string): string | null => {
      if (slot === JUDGE_SLOT) return state.judge.stored ? state.judge.modelId : null;
      const found = state.responders.find((r) => r.slot === slot && r.stored);
      return found ? found.modelId : null;
    },
    [state],
  );

  const allParticipantsOwn = useCallback(
    (slots: string[]) =>
      slots.length > 0 && slots.every((slot) => isOwnKey(slot)) && state.judge.stored,
    [isOwnKey, state],
  );

  const activeResponders = useMemo(() => state.responders.filter((r) => r.stored), [state]);

  const value = useMemo<KeysValue>(
    () => ({
      state,
      isOpen,
      open,
      close,
      saveKeys,
      removeKey,
      activeResponders,
      judgeActive: state.judge.stored,
      isOwnKey,
      byokModelId,
      allParticipantsOwn,
    }),
    [
      state,
      isOpen,
      open,
      close,
      saveKeys,
      removeKey,
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
