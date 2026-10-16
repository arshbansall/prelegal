/**
 * The signed-in user, kept in localStorage so it survives reloads.
 *
 * PL-8 only has a placeholder sign-in, so this is a UX convenience rather than
 * security: anyone can edit localStorage. Real authentication should move the
 * session to an httpOnly cookie or a token the backend verifies.
 *
 * Exposes a subscribe/getSnapshot pair for React's useSyncExternalStore.
 */

export type User = { id: number; email: string };

const STORAGE_KEY = "prelegal.user";

const listeners = new Set<() => void>();

// getUser must return the same object while the stored value is unchanged,
// as useSyncExternalStore requires a stable snapshot.
let cachedRaw: string | null = null;
let cachedUser: User | null = null;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // Storage can be blocked, e.g. by privacy settings.
  }
}

function parseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value?.id === "number" && typeof value?.email === "string"
      ? { id: value.id, email: value.email }
      : null;
  } catch {
    return null;
  }
}

export function getUser(): User | null {
  const raw = storage()?.getItem(STORAGE_KEY) ?? null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedUser = parseUser(raw);
  }
  return cachedUser;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function setUser(user: User) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(user));
  notify();
}

export function clearUser() {
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
