/**
 * Client for the Prelegal backend. Paths are relative (`/api/...`): in
 * production FastAPI serves this app and the API from the same origin, and in
 * development `next dev` proxies `/api` to the backend (see next.config.ts).
 */
import type { User } from "@/lib/session";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Extracts a readable message from a FastAPI error body (`{"detail": ...}`). */
function errorMessage(body: unknown): string | undefined {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  return undefined;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Can’t reach the server. Check your connection and try again.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(body) ?? `Request failed (${response.status}).`);
  }
  return body as T;
}

/** Placeholder sign-in (PL-8): the backend accepts any password and records the email. */
export function login(email: string, password: string): Promise<User> {
  return apiFetch<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
