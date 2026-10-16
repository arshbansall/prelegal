import { describe, expect, it } from "vitest";
import { GREETING, recentMessages, type ChatMessage } from "@/lib/chat";

describe("GREETING", () => {
  it("is an assistant message about the Mutual NDA", () => {
    expect(GREETING.role).toBe("assistant");
    expect(GREETING.content).toContain("Mutual Non-Disclosure Agreement");
  });
});

describe("recentMessages", () => {
  const conversation = (length: number): ChatMessage[] =>
    Array.from({ length }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: `${i}` }));

  it("keeps a short conversation as is", () => {
    const history = conversation(5);
    expect(recentMessages(history)).toEqual(history);
  });

  it("keeps the 40 most recent messages of a long one", () => {
    const history = conversation(100);
    expect(recentMessages(history)).toEqual(history.slice(60));
  });
});
