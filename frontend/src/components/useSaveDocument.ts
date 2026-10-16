"use client";

import { useRef, useState } from "react";
import { errorMessage, saveDocument } from "@/lib/api";
import { saveKey, type SavedDocument, type SavedDocumentInput } from "@/lib/savedDocuments";

export type SaveStatus = "idle" | "saving" | "error";

/**
 * Saving the document being drafted. The first save creates it; later saves
 * replace it. `input` is what would be saved now (null until an agreement is
 * chosen), and `dirty` tells whether it changed since the last save.
 */
export function useSaveDocument({
  input,
  initial,
  onCreated,
}: {
  input: SavedDocumentInput | null;
  /** The saved document being resumed, if any. */
  initial?: SavedDocument;
  /** Called with the id of a newly created document. */
  onCreated?: (id: number) => void;
}) {
  const [savedId, setSavedId] = useState<number | null>(initial?.id ?? null);
  const [savedKey, setSavedKey] = useState<string | null>(() => (initial ? saveKey(initial) : null));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // The save in progress, so overlapping saves (e.g. Save, then Download PDF)
  // run one after another and never create the document twice.
  const inFlight = useRef<Promise<unknown>>(Promise.resolve());
  const latestId = useRef(savedId);
  // Bumped by reset(), so a save that finishes afterwards (for the draft that
  // was discarded) is ignored.
  const generation = useRef(0);

  const dirty = input !== null && saveKey(input) !== savedKey;

  /** Saves `input`; resolves to whether it was saved. */
  function save(): Promise<boolean> {
    if (!input) return Promise.resolve(false);
    const snapshot = input;
    const started = generation.current;
    setStatus("saving");
    setError(null);

    const run = inFlight.current.then(async () => {
      if (started !== generation.current) return false;
      try {
        const saved = await saveDocument(latestId.current, snapshot);
        if (started !== generation.current) return false;
        if (latestId.current === null) onCreated?.(saved.id);
        latestId.current = saved.id;
        setSavedId(saved.id);
        setSavedKey(saveKey(snapshot));
        setStatus("idle");
        return true;
      } catch (e) {
        if (started !== generation.current) return false;
        setStatus("error");
        setError(errorMessage(e, "Couldn’t save. Please try again."));
        return false;
      }
    });
    inFlight.current = run;
    return run;
  }

  /** Forgets the saved document, so the next save creates a new one. */
  function reset() {
    generation.current++;
    latestId.current = null;
    setSavedId(null);
    setSavedKey(null);
    setStatus("idle");
    setError(null);
  }

  return { savedId, dirty, status, error, save, reset };
}
