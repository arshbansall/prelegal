/** Types and helpers for the AI chat that drafts the agreements (PL-9, PL-10). */
import type { DocumentSpec, DocumentUpdates } from "@/lib/documents";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** One reply from `POST /api/chat`. */
export type ChatResult = {
  reply: string;
  /**
   * The agreement being drafted after this turn; null until one is chosen.
   * When it changes, switch to it before applying `updates`.
   */
  documentId: string | null;
  /** Only the fields the AI changed. */
  updates: DocumentUpdates;
  /** Whether every required field is filled once `updates` are applied. */
  complete: boolean;
};

/** The assistant's opening message. Written here so loading the page doesn't call the AI. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I’ll help you draft a legal agreement, such as a mutual NDA, a cloud service agreement, " +
    "a pilot agreement or a data processing agreement. What do you need, and who are the parties?",
};

/** The assistant's note when the user picks an agreement themselves, so the chat stays in context. */
export function documentChosenMessage(spec: DocumentSpec, isFirst: boolean): ChatMessage {
  const [role1, role2] = spec.parties;
  return {
    role: "assistant",
    content: isFirst
      ? `Let’s draft a ${spec.name}. To start, who are the ${role1} and the ${role2}, and what is the agreement for?`
      : `Switched to the ${spec.name}. Details shared between agreements, like the parties and governing law, ` +
        "carry over. Tell me what else you know and I’ll fill it in.",
  };
}

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
