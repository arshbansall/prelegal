"use client";

import { useRef, useState } from "react";
import { ApiError, sendChat } from "@/lib/api";
import { GREETING, type ChatMessage, type ChatResult } from "@/lib/chat";
import type { DocumentValues } from "@/lib/documents";

/**
 * State for the AI chat that drafts the agreement. The caller owns the
 * document: each turn sends the agreement and its current `values`, and
 * `onResult` receives the agreement after the turn and the fields the AI changed.
 */
export function useDocumentChat({
  documentId,
  values,
  today,
  onResult,
}: {
  documentId: string | null;
  values: DocumentValues;
  today: string;
  onResult: (result: ChatResult) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  // Identifies the latest request, so a reply that arrives after Start over
  // (or after a newer request) is ignored.
  const latestRequest = useRef(0);

  async function request(history: ChatMessage[]) {
    const id = ++latestRequest.current;
    setPending(true);
    setError(null);
    try {
      const result = await sendChat(history, documentId, values, today);
      if (id !== latestRequest.current) return;
      setMessages([...history, { role: "assistant", content: result.reply }]);
      setComplete(result.complete);
      onResult(result);
    } catch (e) {
      if (id !== latestRequest.current) return;
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      if (id === latestRequest.current) setPending(false);
    }
  }

  /** Sends a user message. On failure it stays in the conversation, ready to retry. */
  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    void request(history);
  }

  /** Re-sends the conversation after a failed turn. */
  function retry() {
    if (!pending) void request(messages);
  }

  /** Adds an assistant message without calling the AI, e.g. after the user picks an agreement. */
  function addAssistantMessage(message: ChatMessage) {
    setMessages((current) => [...current, message]);
    setError(null);
    setComplete(false);
  }

  function reset() {
    latestRequest.current++;
    setMessages([GREETING]);
    setPending(false);
    setError(null);
    setComplete(false);
  }

  return { messages, pending, error, complete, send, retry, addAssistantMessage, reset };
}
