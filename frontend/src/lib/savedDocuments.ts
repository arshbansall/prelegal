/** Saved agreements (`/api/documents`): types and helpers for saving and resuming drafts. */
import type { ChatMessage } from "@/lib/chat";
import type { DocumentValues } from "@/lib/documents";

/** What is saved: enough to resume drafting where the user left off. Mirrors SavedDocumentIn. */
export type SavedDocumentInput = {
  documentId: string;
  values: DocumentValues;
  messages: ChatMessage[];
  /** Whether the effective date was set (otherwise it follows today's date). */
  dateEdited: boolean;
};

/** One entry in the user's list of documents. */
export type SavedDocumentSummary = {
  id: number;
  documentId: string;
  /** The agreement's name, e.g. "Mutual Non-Disclosure Agreement". */
  documentName: string;
  /** The parties' companies, e.g. "Acme Corp & Beta LLC", or "Untitled …". */
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedDocument = SavedDocumentSummary & SavedDocumentInput;

/** The backend keeps at most this many messages per document (SAVED_MESSAGES_MAX). */
export const MAX_SAVED_MESSAGES = 200;

export function savedInput(
  documentId: string,
  values: DocumentValues,
  messages: ChatMessage[],
  dateEdited: boolean,
): SavedDocumentInput {
  return { documentId, values, messages: messages.slice(-MAX_SAVED_MESSAGES), dateEdited };
}

/**
 * A stable fingerprint of what would be saved, to tell whether anything
 * changed since the last save. The effective date is excluded while it only
 * follows today, so a draft isn't "changed" just because the day rolled over.
 */
export function saveKey({ documentId, values, messages, dateEdited }: SavedDocumentInput): string {
  return stableStringify({
    documentId,
    values: dateEdited ? values : { ...values, effectiveDate: "" },
    messages,
    dateEdited,
  });
}

/** JSON with object keys sorted, so equal values give equal strings whatever their key order. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );
}

/** The `id` query parameter of /draft/?id=N, or null when absent or not a positive whole number. */
export function parseDocumentIdParam(value: string | null): number | null {
  if (!value || !/^[1-9]\d{0,9}$/.test(value)) return null;
  return Number(value);
}

export function draftUrl(id: number | null): string {
  return id === null ? "/draft/" : `/draft/?id=${id}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** When a document was saved, relative to `now` for the last week, e.g. "5 minutes ago". */
export function formatSavedAt(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();
  if (Number.isNaN(elapsed)) return "";
  if (elapsed < MINUTE) return "just now";

  const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 7 * DAY) return relative.format(-Math.floor(elapsed / DAY), "day");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
