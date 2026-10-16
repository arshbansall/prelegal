import { describe, expect, it } from "vitest";
import { documentChosenMessage, GREETING, recentMessages, type ChatMessage } from "@/lib/chat";
import type { DocumentSpec } from "@/lib/documents";

describe("GREETING", () => {
  it("is an assistant message asking which agreement the user needs", () => {
    expect(GREETING.role).toBe("assistant");
    expect(GREETING.content).toContain("What do you need");
  });
});

describe("documentChosenMessage", () => {
  const spec = { name: "Pilot Agreement", parties: ["Provider", "Customer"] } as DocumentSpec;

  it("asks about the parties when the agreement is the first choice", () => {
    const message = documentChosenMessage(spec, true);
    expect(message.role).toBe("assistant");
    expect(message.content).toContain("who are the Provider and the Customer");
  });

  it("says that shared details carry over after a switch", () => {
    expect(documentChosenMessage(spec, false).content).toMatch(/^Switched to the Pilot Agreement\..*carry over/);
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
