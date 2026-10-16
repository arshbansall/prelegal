"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DocumentCreator } from "@/components/DocumentCreator";
import { buttonClass } from "@/components/ui/fields";
import { Callout, PageSpinner } from "@/components/ui/layout";
import { ApiError, errorMessage, getDocument } from "@/lib/api";
import type { AgreementDocument } from "@/lib/documents";
import { draftUrl, parseDocumentIdParam, type SavedDocument } from "@/lib/savedDocuments";

/**
 * The drafting screen for /draft/ (a new document) or /draft/?id=N (a saved
 * one). Saving a new document puts its id in the URL, so reloading resumes it,
 * without remounting the screen it was drafted on.
 */
export function DraftPage({ documents }: { documents: AgreementDocument[] }) {
  const id = parseDocumentIdParam(useSearchParams().get("id"));
  // The document this page created by saving a new draft (now in the URL).
  const [created, setCreated] = useState<number | null>(null);
  // Changes for each new draft, so returning to /draft/ starts afresh.
  const [generation, setGeneration] = useState(0);
  const [previousId, setPreviousId] = useState(id);

  // Checked only when the URL changes: `created` is set a render before the
  // URL shows it.
  if (id !== previousId) {
    setPreviousId(id);
    if (created !== null && id !== created) {
      // Navigated away from the draft this page created (e.g. "New document").
      setCreated(null);
      setGeneration((value) => value + 1);
    }
  }

  function handleCreated(newId: number) {
    setCreated(newId);
    window.history.replaceState(null, "", draftUrl(newId));
  }

  if (id === null || id === created) {
    return <DocumentCreator key={`new-${generation}`} documents={documents} onCreated={handleCreated} />;
  }
  return <SavedDraft key={id} id={id} documents={documents} />;
}

type Load =
  | { status: "loading" }
  | { status: "loaded"; document: SavedDocument }
  | { status: "error"; message: string };

/** Loads a saved document, then opens it for editing. */
function SavedDraft({ id, documents }: { id: number; documents: AgreementDocument[] }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getDocument(id)
      .then((document) => {
        if (cancelled) return;
        const known = documents.some((agreement) => agreement.spec.id === document.documentId);
        setLoad(
          known
            ? { status: "loaded", document }
            : { status: "error", message: "This agreement is no longer available." },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiError && error.status === 404
            ? "This document doesn’t exist, or it was deleted."
            : errorMessage(error, "Couldn’t open the document. Please try again.");
        setLoad({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [id, documents]);

  if (load.status === "loaded") return <DocumentCreator documents={documents} initial={load.document} />;
  if (load.status === "loading") return <PageSpinner label="Opening document…" />;
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <Callout tone="error" title="Couldn’t open this document">
        {load.message}
      </Callout>
      <div className="mt-6 flex gap-3">
        <Link href="/documents/" className={buttonClass("secondary")}>
          Back to my documents
        </Link>
        <Link href="/draft/" className={buttonClass("primary")}>
          New document
        </Link>
      </div>
    </div>
  );
}
