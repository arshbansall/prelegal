import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  deleteDocument,
  fetchCurrentUser,
  getDocument,
  listDocuments,
  login,
  logout,
  saveDocument,
  sendChat,
  signup,
} from "@/lib/api";
import { GREETING, type ChatMessage } from "@/lib/chat";
import { emptyValues } from "@/lib/documents";
import type { SavedDocumentInput } from "@/lib/savedDocuments";
import { getSession, setSession } from "@/lib/session";
import { installBrowserStubs } from "@/testing/browser";

const SESSION = { token: "secret-token", user: { id: 7, email: "ada@acme.com" } };

function mockFetch(status: number, body: unknown) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authentication", () => {
  it("sends no Authorization header when signed out", async () => {
    const fetch = mockFetch(200, SESSION);
    await login("ada@acme.com", "secret");
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });

  it("sends the session's bearer token", async () => {
    setSession(SESSION);
    const fetch = mockFetch(200, SESSION.user);

    await expect(fetchCurrentUser()).resolves.toEqual(SESSION.user);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/auth/me");
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it("clears the session when the backend rejects the token", async () => {
    setSession(SESSION);
    mockFetch(401, { detail: "Please sign in again." });

    await expect(listDocuments()).rejects.toMatchObject({ status: 401, message: "Please sign in again." });
    expect(getSession()).toBeNull();
  });

  it("keeps the session on other errors", async () => {
    setSession(SESSION);
    mockFetch(500, { detail: "Oops" });

    await expect(listDocuments()).rejects.toMatchObject({ status: 500 });
    expect(getSession()).toEqual(SESSION);
  });

  it.each([
    ["login", login],
    ["signup", signup],
  ])("treats a 401 from %s as wrong credentials, not an expired session", async (_, call) => {
    setSession(SESSION);
    mockFetch(401, { detail: "Incorrect email or password." });

    await expect(call("ada@acme.com", "wrong")).rejects.toMatchObject({ message: "Incorrect email or password." });
    expect(getSession()).toEqual(SESSION);
  });
});

describe("login and signup", () => {
  it.each([
    ["login", login, "/api/auth/login"],
    ["signup", signup, "/api/auth/signup"],
  ])("%s posts the credentials as JSON and returns the session", async (_, call, path) => {
    const fetch = mockFetch(200, SESSION);

    await expect(call("ada@acme.com", "secret")).resolves.toEqual(SESSION);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(path);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ email: "ada@acme.com", password: "secret" });
  });

  it("logs out with the session's token and accepts an empty response", async () => {
    setSession(SESSION);
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);

    await expect(logout()).resolves.toBeUndefined();

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/auth/logout");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it("surfaces FastAPI string errors", async () => {
    mockFetch(400, { detail: "Email is required." });
    await expect(login("", "")).rejects.toMatchObject({ status: 400, message: "Email is required." });
  });

  it("surfaces the first FastAPI validation error", async () => {
    mockFetch(422, { detail: [{ msg: "String should have at least 1 character" }] });
    await expect(login("", "x")).rejects.toMatchObject({
      status: 422,
      message: "String should have at least 1 character",
    });
  });

  it("falls back to a generic message for unexpected bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));
    await expect(login("a@b.c", "x")).rejects.toMatchObject({ status: 502, message: "Request failed (502)." });
  });

  it("reports network failures as an ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await login("a@b.c", "x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0 });
  });
});

describe("sendChat", () => {
  const messages: ChatMessage[] = [GREETING, { role: "user", content: "We're Acme Corp." }];

  it("posts the conversation, the agreement, the document and today's date, and returns the reply", async () => {
    const result = {
      reply: "Thanks!",
      documentId: "pilot",
      updates: { party1: { company: "Acme Corp" } },
      complete: false,
    };
    const fetch = mockFetch(200, result);

    await expect(sendChat(messages, "pilot", emptyValues, "2026-10-16")).resolves.toEqual(result);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      messages,
      documentId: "pilot",
      values: emptyValues,
      today: "2026-10-16",
    });
  });

  it("sends a null agreement before one is chosen", async () => {
    const fetch = mockFetch(200, { reply: "Hi", documentId: null, updates: {}, complete: false });
    await sendChat(messages, null, emptyValues, "2026-10-16");
    expect(JSON.parse(fetch.mock.calls[0][1].body).documentId).toBeNull();
  });

  it("sends a null date before the browser's date is known", async () => {
    const fetch = mockFetch(200, { reply: "Hi", updates: {}, complete: false });
    await sendChat(messages, null, emptyValues, "");
    expect(JSON.parse(fetch.mock.calls[0][1].body).today).toBeNull();
  });

  it("sends only the most recent messages of a long conversation", async () => {
    const fetch = mockFetch(200, { reply: "Hi", updates: {}, complete: false });
    const long: ChatMessage[] = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `message ${i}`,
    }));

    await sendChat(long, null, emptyValues, "2026-10-16");

    const sent: ChatMessage[] = JSON.parse(fetch.mock.calls[0][1].body).messages;
    expect(sent).toHaveLength(40);
    expect(sent.at(-1)).toEqual(long.at(-1));
  });

  it("surfaces the backend's error message", async () => {
    mockFetch(503, { detail: "The AI assistant isn’t set up: OPENROUTER_API_KEY is missing." });
    await expect(sendChat(messages, null, emptyValues, "2026-10-16")).rejects.toMatchObject({
      status: 503,
      message: "The AI assistant isn’t set up: OPENROUTER_API_KEY is missing.",
    });
  });
});

describe("saved documents", () => {
  const input: SavedDocumentInput = {
    documentId: "mutual-nda",
    values: emptyValues,
    messages: [GREETING],
    dateEdited: false,
  };

  it("creates a new document with POST and updates a saved one with PUT", async () => {
    const fetch = mockFetch(200, { id: 3 });

    await saveDocument(null, input);
    await saveDocument(3, input);

    expect(fetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/documents", "POST"],
      ["/api/documents/3", "PUT"],
    ]);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(input);
  });

  it("lists, opens and deletes documents", async () => {
    const fetch = mockFetch(200, []);

    await listDocuments();
    await getDocument(4);
    await deleteDocument(4);

    expect(fetch.mock.calls.map(([url, init]) => [url, init.method ?? "GET"])).toEqual([
      ["/api/documents", "GET"],
      ["/api/documents/4", "GET"],
      ["/api/documents/4", "DELETE"],
    ]);
  });
});
