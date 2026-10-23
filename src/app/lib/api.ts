// HTTP client for the GUDS API: bearer token from the login page, the
// global error format ({code, detail, errors}) turned into ApiError.

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

export async function apiGet(path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const token = getToken();
  const response = await fetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
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
