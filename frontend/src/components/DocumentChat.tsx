"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, controlClass } from "@/components/ui/fields";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/chat";

function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Plain text, never HTML: the AI's reply is untrusted. */}
      <p
        className={
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm " +
          (isUser ? "rounded-br-sm bg-secondary text-white" : "rounded-bl-sm bg-slate-100 text-slate-800")
        }
      >
        <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
        {message.content}
      </p>
    </li>
  );
}

function TypingIndicator() {
  return (
    <li className="flex justify-start">
      <span className="flex gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3">
        <span className="sr-only">Assistant is typing…</span>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden
            style={{ animationDelay: `${delay}ms` }}
            className="size-1.5 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none"
          />
        ))}
      </span>
    </li>
  );
}

/** "Start over", with an inline confirmation because it discards the draft. */
function StartOver({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        type="button"
        className="shrink-0 whitespace-nowrap px-2 py-1 text-xs"
        onClick={() => setConfirming(true)}
      >
        Start over
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs text-slate-600">
      <span>Clear the chat and the document?</span>
      <Button
        variant="ghost"
        type="button"
        className="px-2 py-1 text-xs text-red-700"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        Clear
      </Button>
      <Button variant="ghost" type="button" className="px-2 py-1 text-xs" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}

export function DocumentChat({
  messages,
  pending,
  error,
  complete,
  onSend,
  onRetry,
  onStartOver,
}: {
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
  complete: boolean;
  onSend: (text: string) => void;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLOListElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending, error]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (pending || !draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a line break. Ignore Enter while an IME is composing.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-3">
        <p className="text-xs text-slate-500">Answer in your own words. The document updates as you go.</p>
        <StartOver onConfirm={onStartOver} />
      </div>

      {/* `relative` keeps the messages' screen-reader labels inside this scroller, so they never make the page scroll. */}
      <ol
        ref={logRef}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4"
      >
        {messages.map((message, i) => (
          <Message key={i} message={message} />
        ))}
        {pending && <TypingIndicator />}
        {complete && !pending && !error && (
          <li className="rounded-md border border-accent/60 bg-accent/10 px-3 py-2 text-xs text-slate-800">
            All required fields are filled in. Review the document, then use Download PDF.
          </li>
        )}
      </ol>

      {error && (
        <div role="alert" className="mx-5 mb-2 flex shrink-0 items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{error}</p>
          <Button variant="ghost" type="button" className="shrink-0 px-2 py-1 text-xs" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-slate-200 p-3">
        <textarea
          aria-label="Message"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          value={draft}
          placeholder="Type your answer…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${controlClass} min-h-11 flex-1 resize-none px-3 py-2`}
        />
        <Button type="submit" disabled={pending} aria-busy={pending}>
          Send
        </Button>
      </form>
    </div>
  );
}
