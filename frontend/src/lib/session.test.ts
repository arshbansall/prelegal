import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearUser, getUser, setUser, subscribe } from "@/lib/session";

/** A minimal in-memory localStorage plus window event target. */
function installBrowserStubs() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  const events = new EventTarget();
  vi.stubGlobal("window", {
    localStorage,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  });
  return { store, events };
}

describe("session", () => {
  let browser: ReturnType<typeof installBrowserStubs>;

  beforeEach(() => {
    browser = installBrowserStubs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips the signed-in user", () => {
    expect(getUser()).toBeNull();
    setUser({ id: 1, email: "ada@acme.com" });
    expect(getUser()).toEqual({ id: 1, email: "ada@acme.com" });
    clearUser();
    expect(getUser()).toBeNull();
  });

  it("returns the same object until the stored value changes", () => {
    setUser({ id: 1, email: "ada@acme.com" });
    const first = getUser();
    expect(getUser()).toBe(first);
    setUser({ id: 2, email: "alan@beta.com" });
    expect(getUser()).not.toBe(first);
  });

  it("ignores malformed stored values", () => {
    browser.store.set("prelegal.user", "{not json");
    expect(getUser()).toBeNull();
    browser.store.set("prelegal.user", JSON.stringify({ id: "1", email: 42 }));
    expect(getUser()).toBeNull();
  });

  it("notifies subscribers on sign-in, sign-out and changes from other tabs", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    setUser({ id: 1, email: "ada@acme.com" });
    clearUser();
    browser.events.dispatchEvent(Object.assign(new Event("storage"), { key: "prelegal.user" }));
    browser.events.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated" }));
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    setUser({ id: 1, email: "ada@acme.com" });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("returns no user when storage is unavailable (e.g. during prerendering)", () => {
    vi.unstubAllGlobals();
    expect(getUser()).toBeNull();
  });
});
