import { describe, expect, it } from "vitest";
import { GREETING, type ChatMessage } from "@/lib/chat";
import { emptyValues } from "@/lib/documents";
import {
  MAX_SAVED_MESSAGES,
  draftUrl,
  formatSavedAt,
  parseDocumentIdParam,
  saveKey,
  savedInput,
  type SavedDocument,
} from "@/lib/savedDocuments";

const values = { ...emptyValues, effectiveDate: "2026-10-16", party1: { ...emptyValues.party1, company: "Acme" } };

describe("savedInput", () => {
  it("keeps only the most recent messages the backend accepts", () => {
    const messages: ChatMessage[] = Array.from({ length: MAX_SAVED_MESSAGES + 5 }, (_, i) => ({
      role: "user",
      content: `message ${i}`,
    }));

    const input = savedInput("mutual-nda", values, messages, true);

    expect(input.messages).toHaveLength(MAX_SAVED_MESSAGES);
    expect(input.messages.at(-1)).toEqual(messages.at(-1));
    expect(input).toMatchObject({ documentId: "mutual-nda", values, dateEdited: true });
  });
});

describe("saveKey", () => {
  const input = savedInput("mutual-nda", values, [GREETING], true);

  it("changes when anything that is saved changes", () => {
    const key = saveKey(input);
    expect(saveKey({ ...input })).toBe(key);
    expect(saveKey({ ...input, documentId: "pilot" })).not.toBe(key);
    expect(saveKey({ ...input, values: { ...values, governingLaw: "Delaware" } })).not.toBe(key);
    expect(saveKey({ ...input, messages: [] })).not.toBe(key);
    expect(saveKey({ ...input, dateEdited: false })).not.toBe(key);
  });

  it("ignores key order and the other fields of a saved document", () => {
    const reordered = { ...input, values: Object.fromEntries(Object.entries(values).reverse()) as typeof values };
    const saved: SavedDocument = {
      ...input,
      id: 1,
      documentName: "Mutual Non-Disclosure Agreement",
      title: "Acme",
      createdAt: "2026-10-16T10:00:00Z",
      updatedAt: "2026-10-16T10:00:00Z",
    };
    expect(saveKey(reordered)).toBe(saveKey(input));
    expect(saveKey(saved)).toBe(saveKey(input));
  });

  it("ignores the effective date while it only follows today", () => {
    const following = { ...input, dateEdited: false };
    expect(saveKey({ ...following, values: { ...values, effectiveDate: "2026-10-17" } })).toBe(saveKey(following));
  });
});

describe("parseDocumentIdParam", () => {
  it.each([
    ["12", 12],
    ["1", 1],
    [null, null],
    ["", null],
    ["0", null],
    ["-3", null],
    ["1.5", null],
    ["abc", null],
    ["12abc", null],
    ["99999999999", null],
  ])("parses %j as %j", (value, expected) => {
    expect(parseDocumentIdParam(value)).toBe(expected);
  });
});

describe("draftUrl", () => {
  it("links to a new draft or a saved document", () => {
    expect(draftUrl(null)).toBe("/draft/");
    expect(draftUrl(5)).toBe("/draft/?id=5");
  });
});

describe("formatSavedAt", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it.each([
    [ago(20_000), "just now"],
    [ago(5 * 60_000), "5 minutes ago"],
    [ago(3 * 3_600_000), "3 hours ago"],
    [ago(26 * 3_600_000), "yesterday"],
    [ago(3 * 86_400_000), "3 days ago"],
  ])("formats %s as %j", (iso, expected) => {
    expect(formatSavedAt(iso, now)).toBe(expected);
  });

  it("shows a date for older documents, with the year only when it differs", () => {
    expect(formatSavedAt("2026-09-01T12:00:00Z", now)).toBe("Sep 1");
    expect(formatSavedAt("2025-09-01T12:00:00Z", now)).toBe("Sep 1, 2025");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatSavedAt("not a date", now)).toBe("");
  });
});
