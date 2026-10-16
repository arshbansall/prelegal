/**
 * The signed-in session: the backend's bearer token and the user it belongs
 * to, kept in localStorage so it survives reloads. `lib/api.ts` sends the token
 * with every request and clears the session when the backend rejects it
 * (e.g. after the server restarted, since its database is temporary).
 *
 * Exposes a subscribe/getSnapshot pair for React's useSyncExternalStore.
 */

export type User = { id: number; email: string };
export type Session = { token: string; user: User };

const STORAGE_KEY = "prelegal.session";

const listeners = new Set<() => void>();

// getSession must return the same object while the stored value is unchanged,
// as useSyncExternalStore requires a stable snapshot.
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // Storage can be blocked, e.g. by privacy settings.
  }
}

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const { token, user } = value ?? {};
    return typeof token === "string" && token && typeof user?.id === "number" && typeof user?.email === "string"
      ? { token, user: { id: user.id, email: user.email } }
      : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const raw = storage()?.getItem(STORAGE_KEY) ?? null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parseSession(raw);
  }
  return cachedSession;
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function setSession(session: Session) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(session));
  notify();
}

export function clearSession() {
  storage()?.removeItem(STORAGE_KEY);
  notify();
}

/** Calls `listener` when the session changes in this tab or another one. */
export function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
