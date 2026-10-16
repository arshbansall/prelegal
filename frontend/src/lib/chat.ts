/** Types and helpers for the AI chat that drafts the Mutual NDA (PL-9). */
import type { NdaUpdates } from "@/lib/nda";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** One reply from `POST /api/chat`. */
export type ChatResult = {
  reply: string;
  /** Only the fields the AI changed. */
  updates: NdaUpdates;
  /** Whether every required field is filled once `updates` are applied. */
  complete: boolean;
};

/** The assistant's opening message. Written here so loading the page doesn't call the AI. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I’ll help you draft a Mutual Non-Disclosure Agreement. To start, who are the two parties, " +
    "and why will you be sharing confidential information?",
};

/** Longest message the backend accepts. */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * The backend accepts at most 60 messages. The document itself carries what
 * was agreed, so only the most recent part of a long conversation is sent.
 */
const MAX_HISTORY = 40;

export function recentMessages(history: ChatMessage[]): ChatMessage[] {
  return history.slice(-MAX_HISTORY);
}
