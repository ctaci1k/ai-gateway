// frontend/services/apiClient.ts
//
// Shared API client. Base URL from env; cookies sent with every request
// (credentials: "include"); CSRF token echoed back on mutating requests
// (double-submit, see backend core/auth.py).

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface ApiErrorOptions {
  code?: string;
  status?: number;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  code: string;
  status?: number;

  constructor(message: string, { code, status }: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code || "unknown_error";
    this.status = status;
  }
}

function csrfHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? { "X-CSRF-Token": decodeURIComponent(match[1]) } : {};
}

export interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

// Core request helper: attaches base URL, cookies, JSON headers and CSRF.
// FormData bodies are sent as-is (the browser sets the multipart Content-Type).
export async function apiFetch(
  path: string,
  { method = "GET", body, headers = {} }: ApiFetchOptions = {},
): Promise<Response> {
  const isMutation = method.toUpperCase() !== "GET";
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(isMutation ? csrfHeader() : {}),
      ...headers,
    },
    body: body == null ? undefined : isFormData ? body : JSON.stringify(body),
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  let parsed: ErrorBody | null = null;
  try {
    parsed = (await response.json()) as ErrorBody;
  } catch {
    // Non-JSON / empty error body.
  }
  const error = parsed?.error;
  return new ApiError(error?.message || `Request failed (${response.status})`, {
    code: error?.code || "http_error",
    status: response.status,
  });
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

export async function ensureOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}
