// frontend/services/adminApi.ts
//
// Typed admin API (PH15, D-10): manage accounts + quotas and read the usage
// audit. All requests go through the shared apiClient (cookies + CSRF);
// components never call fetch directly. The backend admin-gates every route.

import { apiFetch, parseJsonResponse } from "@/services/apiClient";
import type {
  AdminUserSummary,
  AdminUserUsage,
  CreateUserPayload,
  UpdateUserPayload,
} from "@/types/api";

interface AdminUserListResponse {
  users: AdminUserSummary[];
}

export async function listUsers(): Promise<AdminUserSummary[]> {
  const response = await apiFetch("/admin/users");
  const data = await parseJsonResponse<AdminUserListResponse>(response);
  return data.users;
}

export async function getUserUsage(userId: number): Promise<AdminUserUsage> {
  const response = await apiFetch(`/admin/users/${userId}/usage`);
  return parseJsonResponse<AdminUserUsage>(response);
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUserSummary> {
  const response = await apiFetch("/admin/users", { method: "POST", body: payload });
  return parseJsonResponse<AdminUserSummary>(response);
}

export async function updateUser(
  userId: number,
  payload: UpdateUserPayload,
): Promise<AdminUserSummary> {
  const response = await apiFetch(`/admin/users/${userId}`, {
    method: "PATCH",
    body: payload,
  });
  return parseJsonResponse<AdminUserSummary>(response);
}

// Delete an account and all its data (PH34). The backend forbids deleting your
// own account or the primary admin (throws ApiError → the caller surfaces it).
export async function deleteUser(userId: number): Promise<void> {
  const response = await apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
  await parseJsonResponse<{ deleted: boolean; id: number }>(response);
}
