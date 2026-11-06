// HTTP client for the GUDS API: bearer token from the login page, the
// interface language as Accept-Language, the global error format
// ({code, detail, errors}) turned into ApiError.

import { currentLanguage } from "./i18n";

export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://api.guds.inc";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem("access_token");
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  } catch {
    // storage unavailable: nothing to clear
  }
}

async function toError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message = response.statusText || "Request failed";
  try {
    const body = await response.json();
    code = body.code ?? code;
    const fieldErrors = Array.isArray(body.errors)
      ? body.errors.map((e: { message?: string }) => e.message).filter(Boolean)
      : [];
    message = fieldErrors.length ? fieldErrors.join(" ") : body.detail ?? message;
  } catch {
    // not JSON (proxy error page): keep the status text
  }
  return new ApiError(response.status, code, message);
}

/**
 * Headers of every API request: the caller's own headers are kept, then the
 * language (read at call time, so a request right after a switch already
 * uses the new one; the API answers messages and CSV headers in it) and the
 * session token unless `auth` is false.
 */
export function apiHeaders(extra: Record<string, string> = {}, auth = true): Record<string, string> {
  const headers: Record<string, string> = { ...extra, "Accept-Language": currentLanguage() };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiGet(path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), { headers: apiHeaders() });
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw await toError(response);
  }
  return response;
}

/** Absolute URL of a path the API returns relative to its own host (e.g. an admin link). */
export function apiUrl(path: string): string {
  return new URL(path, API_BASE).toString();
}
