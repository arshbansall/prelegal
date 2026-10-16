import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getSession, getToken, setSession, subscribe } from "@/lib/session";
import { installBrowserStubs } from "@/testing/browser";

const ADA = { token: "token-1", user: { id: 1, email: "ada@acme.com" } };
const ALAN = { token: "token-2", user: { id: 2, email: "alan@beta.com" } };

describe("session", () => {
  let browser: ReturnType<typeof installBrowserStubs>;

  beforeEach(() => {
    browser = installBrowserStubs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips the session and exposes its token", () => {
    expect(getSession()).toBeNull();
    expect(getToken()).toBeNull();
    setSession(ADA);
    expect(getSession()).toEqual(ADA);
    expect(getToken()).toBe("token-1");
    clearSession();
    expect(getSession()).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("returns the same object until the stored value changes", () => {
    setSession(ADA);
    const first = getSession();
    expect(getSession()).toBe(first);
    setSession(ALAN);
    expect(getSession()).not.toBe(first);
  });

  it("ignores malformed stored values", () => {
    for (const raw of [
      "{not json",
      JSON.stringify({ id: 1, email: "ada@acme.com" }), // A PL-8 user, without a token.
      JSON.stringify({ token: "", user: ADA.user }),
      JSON.stringify({ token: "t", user: { id: "1", email: 42 } }),
      "null",
    ]) {
      browser.store.set("prelegal.session", raw);
      expect(getSession()).toBeNull();
    }
  });

  it("notifies subscribers on sign-in, sign-out and changes from other tabs", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    setSession(ADA);
    clearSession();
    browser.events.dispatchEvent(Object.assign(new Event("storage"), { key: "prelegal.session" }));
    browser.events.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated" }));
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    setSession(ADA);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("returns no session when storage is unavailable (e.g. during prerendering)", () => {
    vi.unstubAllGlobals();
    expect(getSession()).toBeNull();
  });
});
