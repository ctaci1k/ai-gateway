// frontend/services/authApi.ts

import { apiFetch, parseJsonResponse } from "@/services/apiClient";
import type { CurrentUser } from "@/types/api";

export interface User {
  id: number;
  username: string;
}

export interface AuthResult {
  user: User;
  csrf_token: string;
}

export interface Credentials {
  username: string;
  password: string;
}

// Registration is code-gated (D-10): the code is required by the backend.
export interface RegisterCredentials extends Credentials {
  registration_code: string;
}

export async function register(creds: RegisterCredentials): Promise<AuthResult> {
  const response = await apiFetch("/auth/register", {
    method: "POST",
    body: creds,
  });
  return parseJsonResponse<AuthResult>(response);
}

export async function login(creds: Credentials): Promise<AuthResult> {
  const response = await apiFetch("/auth/login", { method: "POST", body: creds });
  return parseJsonResponse<AuthResult>(response);
}

export async function logout(): Promise<void> {
  const response = await apiFetch("/auth/logout", { method: "POST" });
  await parseJsonResponse<{ message: string }>(response);
}

// Returns the current user (identity + admin flag + quota state), or null if
// not authenticated (401).
export async function fetchMe(): Promise<CurrentUser | null> {
  const response = await apiFetch("/auth/me");
  if (response.status === 401) {
    return null;
  }
  return parseJsonResponse<CurrentUser>(response);
}
