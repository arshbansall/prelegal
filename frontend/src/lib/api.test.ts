import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, login } from "@/lib/api";

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
