/**
 * Client for the Prelegal backend. Paths are relative (`/api/...`): in
 * production FastAPI serves this app and the API from the same origin, and in
 * development `next dev` proxies `/api` to the backend (see next.config.ts).
 */
import { recentMessages, type ChatMessage, type ChatResult } from "@/lib/chat";
import type { DocumentValues } from "@/lib/documents";
import type { SavedDocument, SavedDocumentInput, SavedDocumentSummary } from "@/lib/savedDocuments";
import { clearSession, getToken, type Session, type User } from "@/lib/session";

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
function detailMessage(body: unknown): string | undefined {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  return undefined;
}

/** A message to show for a failed request: the backend's, or `fallback` for anything else. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Sign-in requests, whose 401 means wrong credentials rather than an expired session. */
const CREDENTIAL_PATHS = new Set(["/api/auth/login", "/api/auth/signup"]);

/**
 * A JSON request to the backend, sent with the signed-in user's token.
 * A 401 means the session is no longer valid (the server forgets sessions when
 * it restarts), so it is cleared, which sends the user back to sign in.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can’t reach the server. Check your connection and try again.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !CREDENTIAL_PATHS.has(path)) clearSession();
    throw new ApiError(response.status, detailMessage(body) ?? `Request failed (${response.status}).`);
  }
  return body as T;
}

/**
 * One turn of the AI chat. The backend is stateless, so this sends the
 * conversation so far, the agreement being drafted (null until one is chosen)
 * and the document as the user sees it.
 * `today` is the user's local date (yyyy-mm-dd), for resolving relative dates.
 */
export function sendChat(
  messages: ChatMessage[],
  documentId: string | null,
  values: DocumentValues,
  today: string,
): Promise<ChatResult> {
  return apiFetch<ChatResult>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: recentMessages(messages), documentId, values, today: today || null }),
  });
}

// --- Accounts -------------------------------------------------------------------

/** Signs in and returns the new session (its token and the user). */
export function login(email: string, password: string): Promise<Session> {
  return apiFetch<Session>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** Creates an account (passwords need at least 8 characters) and signs it in. */
export function signup(email: string, password: string): Promise<Session> {
  return apiFetch<Session>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** The signed-in user; fails with a 401 (and clears the session) if the token is no longer valid. */
export function fetchCurrentUser(): Promise<User> {
  return apiFetch<User>("/api/auth/me");
}

/** Ends the session on the server. */
export async function logout(): Promise<void> {
  await apiFetch<null>("/api/auth/logout", { method: "POST" });
}

// --- Saved documents ------------------------------------------------------------

export function listDocuments(): Promise<SavedDocumentSummary[]> {
  return apiFetch<SavedDocumentSummary[]>("/api/documents");
}

export function getDocument(id: number): Promise<SavedDocument> {
  return apiFetch<SavedDocument>(`/api/documents/${id}`);
}

/** Saves a new document (`id` null) or replaces a saved one. */
export function saveDocument(id: number | null, input: SavedDocumentInput): Promise<SavedDocument> {
  return apiFetch<SavedDocument>(id === null ? "/api/documents" : `/api/documents/${id}`, {
    method: id === null ? "POST" : "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteDocument(id: number): Promise<void> {
  await apiFetch<null>(`/api/documents/${id}`, { method: "DELETE" });
}
