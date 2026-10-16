import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, login, sendChat } from "@/lib/api";
import { GREETING, type ChatMessage } from "@/lib/chat";
import { defaultNdaValues } from "@/lib/nda";

function mockFetch(status: number, body: unknown) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("posts the credentials as JSON and returns the user", async () => {
    const fetch = mockFetch(200, { id: 7, email: "ada@acme.com" });

    await expect(login("ada@acme.com", "secret")).resolves.toEqual({ id: 7, email: "ada@acme.com" });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ email: "ada@acme.com", password: "secret" });
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

  it("posts the conversation, the document and today's date, and returns the reply", async () => {
    const result = { reply: "Thanks!", updates: { party1: { company: "Acme Corp" } }, complete: false };
    const fetch = mockFetch(200, result);

    await expect(sendChat(messages, defaultNdaValues, "2026-10-16")).resolves.toEqual(result);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ messages, values: defaultNdaValues, today: "2026-10-16" });
  });

  it("sends a null date before the browser's date is known", async () => {
    const fetch = mockFetch(200, { reply: "Hi", updates: {}, complete: false });
    await sendChat(messages, defaultNdaValues, "");
    expect(JSON.parse(fetch.mock.calls[0][1].body).today).toBeNull();
  });

  it("sends only the most recent messages of a long conversation", async () => {
    const fetch = mockFetch(200, { reply: "Hi", updates: {}, complete: false });
    const long: ChatMessage[] = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `message ${i}`,
    }));

    await sendChat(long, defaultNdaValues, "2026-10-16");

    const sent: ChatMessage[] = JSON.parse(fetch.mock.calls[0][1].body).messages;
    expect(sent).toHaveLength(40);
    expect(sent.at(-1)).toEqual(long.at(-1));
  });

  it("surfaces the backend's error message", async () => {
    mockFetch(503, { detail: "The AI assistant isn’t set up: OPENROUTER_API_KEY is missing." });
    await expect(sendChat(messages, defaultNdaValues, "2026-10-16")).rejects.toMatchObject({
      status: 503,
      message: "The AI assistant isn’t set up: OPENROUTER_API_KEY is missing.",
    });
  });
});
