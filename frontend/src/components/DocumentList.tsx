"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, buttonClass } from "@/components/ui/fields";
import { DocumentIcon, PlusIcon } from "@/components/ui/icons";
import { Callout, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/layout";
import { deleteDocument, errorMessage, listDocuments } from "@/lib/api";
import { DISCLAIMER } from "@/lib/disclaimer";
import { draftUrl, formatSavedAt, type SavedDocumentSummary } from "@/lib/savedDocuments";

type Load =
  | { status: "loading" }
  | { status: "loaded"; documents: SavedDocumentSummary[] }
  | { status: "error"; message: string };

/** "My documents": the signed-in user's saved agreements, newest first. */
export function DocumentList() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listDocuments()
      .then((documents) => !cancelled && setLoad({ status: "loaded", documents }))
      .catch((error: unknown) => !cancelled && setLoad({ status: "error", message: errorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setLoad({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function removed(id: number) {
    setLoad((current) =>
      current.status === "loaded"
        ? { ...current, documents: current.documents.filter((document) => document.id !== id) }
        : current,
    );
  }

  const count = load.status === "loaded" ? load.documents.length : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="My documents"
        description={
          count === null
            ? "Agreements you’ve saved. Open one to keep drafting."
            : `${count} saved ${count === 1 ? "agreement" : "agreements"}. Open one to keep drafting.`
        }
        actions={
          <Link href="/draft/" className={buttonClass("primary")}>
            <PlusIcon className="size-4" />
            New document
          </Link>
        }
      />

      <div className="mt-8">
        {load.status === "loading" && <LoadingCards />}
        {load.status === "error" && (
          <Callout tone="error" title="Couldn’t load your documents">
            <p>{load.message}</p>
            <Button variant="secondary" type="button" className="mt-3 px-3 py-1.5 text-xs" onClick={retry}>
              Try again
            </Button>
          </Callout>
        )}
        {load.status === "loaded" &&
          (load.documents.length === 0 ? (
            <EmptyState
              icon={<DocumentIcon className="size-6" />}
              title="No documents yet"
              description="Tell the AI assistant what you need and it drafts the agreement with you. Save it to find it here."
              action={
                <Link href="/draft/" className={buttonClass("primary")}>
                  Draft your first agreement
                </Link>
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {load.documents.map((document) => (
                <li key={document.id}>
                  <DocumentCard document={document} onDeleted={() => removed(document.id)} />
                </li>
              ))}
            </ul>
          ))}
      </div>

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-slate-500">{DISCLAIMER}</p>
    </div>
  );
}

const noopSubscribe = () => () => {};

/** "Saved 5 minutes ago"; empty while prerendering, since it depends on the current time. */
function useSavedAt(iso: string): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => formatSavedAt(iso),
    () => "",
  );
}

function DocumentCard({ document, onDeleted }: { document: SavedDocumentSummary; onDeleted: () => void }) {
  const savedAt = useSavedAt(document.updatedAt);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteDocument(document.id);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <Card className="flex h-full flex-col p-5 transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
          <DocumentIcon />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
            {document.documentName}
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-navy" title={document.title}>
            {document.title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            <time dateTime={document.updatedAt} title={new Date(document.updatedAt).toLocaleString()}>
              {savedAt && `Saved ${savedAt}`}
            </time>
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-auto flex items-center justify-end gap-2 pt-5">
        {confirming ? (
          <>
            <span className="mr-auto text-xs text-slate-600">Delete this document?</span>
            <Button
              variant="ghost"
              type="button"
              className="px-3 py-1.5 text-xs"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              className="px-3 py-1.5 text-xs"
              onClick={confirmDelete}
              disabled={deleting}
              aria-busy={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              type="button"
              className="px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${document.title}`}
            >
              Delete
            </Button>
            <Link
              href={draftUrl(document.id)}
              className={buttonClass("secondary", "px-3 py-1.5 text-xs")}
              aria-label={`Open ${document.title}`}
            >
              Open
            </Link>
          </>
        )}
      </div>
    </Card>
  );
}

function LoadingCards() {
  return (
    <div role="status">
      <span className="sr-only">Loading your documents…</span>
      <ul aria-hidden className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <Card className="space-y-3 p-5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/4" />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
