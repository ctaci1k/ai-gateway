// frontend/store/SidebarContext.tsx
//
// Sidebar layout state (PH23/C1). Two independent dimensions, ChatGPT-style:
//   - collapsed: desktop rail vs full sidebar. Persisted in localStorage so the
//     choice survives reloads. SSR-safe: starts expanded on the server and
//     hydrates the stored value after mount (mirrors LanguageContext).
//   - mobileOpen: the off-canvas drawer on phones. Ephemeral (never persisted) —
//     it always starts closed and is opened by the topbar burger.

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

const STORAGE_KEY = "ai-gateway.sidebar-collapsed";

interface SidebarValue {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  openMobile: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the persisted desktop state after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsed(true);
      }
    } catch {
      // localStorage unavailable (private mode) → keep the default.
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore persistence failure; in-memory state still updates.
      }
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo<SidebarValue>(
    () => ({ collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile }),
    [collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used inside SidebarProvider");
  }
  return context;
}
