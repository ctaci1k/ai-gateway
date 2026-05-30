// frontend/store/AdminViewContext.tsx
//
// Tiny shared toggle for the admin panel view: the sidebar opens it, the page
// shell renders the panel instead of the chat area while it's open.

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface AdminViewValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const AdminViewContext = createContext<AdminViewValue | null>(null);

export function AdminViewProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo<AdminViewValue>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [isOpen],
  );
  return <AdminViewContext.Provider value={value}>{children}</AdminViewContext.Provider>;
}

export function useAdminView(): AdminViewValue {
  const context = useContext(AdminViewContext);
  if (!context) {
    throw new Error("useAdminView must be used inside AdminViewProvider");
  }
  return context;
}
