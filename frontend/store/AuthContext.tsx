// frontend/store/AuthContext.tsx

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type Credentials,
  type RegisterCredentials,
} from "@/services/authApi";
import type { CurrentUser } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthValue {
  user: CurrentUser | null;
  status: AuthStatus;
  login: (creds: Credentials) => Promise<void>;
  register: (creds: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  // Re-read /auth/me to refresh quota usage (e.g. after sending a request).
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Restore session on mount.
  useEffect(() => {
    let active = true;
    fetchMe()
      .then((me) => {
        if (!active) return;
        setUser(me);
        setStatus(me ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!active) return;
        setStatus("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      // login/register set the session cookie; we then hydrate the full
      // CurrentUser (admin flag + quota state) from /auth/me.
      login: async (creds) => {
        await loginRequest(creds);
        const me = await fetchMe();
        setUser(me);
        setStatus(me ? "authenticated" : "anonymous");
      },
      register: async (creds) => {
        await registerRequest(creds);
        const me = await fetchMe();
        setUser(me);
        setStatus(me ? "authenticated" : "anonymous");
      },
      logout: async () => {
        await logoutRequest();
        setUser(null);
        setStatus("anonymous");
      },
      refresh: async () => {
        const me = await fetchMe();
        setUser(me);
        if (!me) setStatus("anonymous");
      },
    }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
