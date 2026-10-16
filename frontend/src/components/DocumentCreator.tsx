"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AgreementForm } from "@/components/AgreementForm";
import { DocumentChat } from "@/components/DocumentChat";
import { DocumentChoices, DocumentPicker } from "@/components/DocumentPicker";
import { DocumentPreview } from "@/components/DocumentPreview";
import { NdaForm } from "@/components/NdaForm";
import { useDocumentChat } from "@/components/useDocumentChat";
import { useSaveDocument } from "@/components/useSaveDocument";
import { Button } from "@/components/ui/fields";
import { CheckIcon, DownloadIcon, ShieldIcon } from "@/components/ui/icons";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { documentChosenMessage, type ChatResult } from "@/lib/chat";
import { DISCLAIMER } from "@/lib/disclaimer";
import {
  applyDocumentUpdates,
  documentMarkdown,
  emptyValues,
  pdfFilename,
  switchDocument,
  type AgreementDocument,
  type DocumentValues,
} from "@/lib/documents";
import { savedInput, type SavedDocument } from "@/lib/savedDocuments";
import { setUnsavedChanges } from "@/lib/unsavedChanges";

const noopSubscribe = () => () => {};

/** Today's date (yyyy-mm-dd) in the user's time zone; empty while prerendering. */
function useToday(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => new Date().toLocaleDateString("en-CA"),
    () => "",
  );
}

type DownloadStatus = "idle" | "generating" | "error";
type Tab = "chat" | "fields";
/** Which panel is shown on narrow screens; wide screens show both side by side. */
type View = "edit" | "preview";

const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "fields", label: "Fields" },
];

/** The agreement being drafted (none until the user or the AI chooses one) and its values. */
type Draft = { documentId: string | null; values: DocumentValues };

const EMPTY_DRAFT: Draft = { documentId: null, values: emptyValues };

/**
 * The drafting page: chat or form on the left, live preview on the right.
 * The page itself never scrolls; each panel scrolls on its own, so the chat
 * input stays in view.
 *
 * `initial` resumes a saved document (the parent remounts this component, via
 * `key`, to open another one); `onCreated` is told when a new draft is first saved.
 */
export function DocumentCreator({
  documents,
  initial,
  onCreated,
}: {
  documents: AgreementDocument[];
  initial?: SavedDocument;
  onCreated?: (id: number) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() =>
    initial ? { documentId: initial.documentId, values: initial.values } : EMPTY_DRAFT,
  );
  const [dateEdited, setDateEdited] = useState(initial?.dateEdited ?? false);
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [tab, setTab] = useState<Tab>("chat");
  const [view, setView] = useState<View>("edit");
  const today = useToday();

  const find = (id: string | null) => documents.find((document) => document.spec.id === id);
  const current = find(draft.documentId);
  const specs = documents.map((document) => document.spec);

  // The Effective Date follows today until the user (or the AI) changes it
  // (clearing it leaves the placeholder).
  const values: DocumentValues = {
    ...draft.values,
    effectiveDate: dateEdited ? draft.values.effectiveDate : today,
  };
  const markdown = current && documentMarkdown(current, values);

  function handleChange(next: DocumentValues) {
    if (next.effectiveDate !== values.effectiveDate) setDateEdited(true);
    setDraft((latest) => ({ ...latest, values: next }));
  }

  // Applied to the latest state, so edits made while the AI was replying are kept.
  function handleResult({ documentId, updates }: ChatResult) {
    if (updates.effectiveDate !== undefined) setDateEdited(true);
    setDraft((latest) => {
      const next = documentId === latest.documentId ? undefined : find(documentId);
      const base = next ? switchDocument(latest.values, next.spec) : latest.values;
      return { documentId: next?.spec.id ?? latest.documentId, values: applyDocumentUpdates(base, updates) };
    });
  }

  const chat = useDocumentChat({
    documentId: draft.documentId,
    values,
    today,
    onResult: handleResult,
    initialMessages: initial?.messages,
  });

  const saver = useSaveDocument({
    input: current ? savedInput(current.spec.id, values, chat.messages, dateEdited) : null,
    initial,
    onCreated,
  });

  // Warn before leaving the page with unsaved changes: in the app (see
  // lib/unsavedChanges.ts), and when reloading or closing the tab.
  useEffect(() => {
    if (!saver.dirty) return;
    setUnsavedChanges(true);
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      setUnsavedChanges(false);
      window.removeEventListener("beforeunload", warn);
    };
  }, [saver.dirty]);

  /** Switches agreement without the AI, keeping the details every agreement shares. */
  function chooseDocument(id: string) {
    const next = find(id);
    if (!next || id === draft.documentId || chat.pending) return;
    setDraft((latest) => ({ documentId: id, values: switchDocument(latest.values, next.spec) }));
    chat.addAssistantMessage(documentChosenMessage(next.spec, draft.documentId === null));
    setStatus("idle");
  }

  function startOver() {
    // A saved document is kept: start a new one on a fresh page. (Start over
    // already asked for confirmation, so the unsaved-changes prompt is skipped.)
    if (saver.savedId !== null) {
      setUnsavedChanges(false);
      router.push("/draft/");
      return;
    }
    chat.reset();
    saver.reset();
    setDraft(EMPTY_DRAFT);
    setDateEdited(false);
    setStatus("idle");
  }

  async function downloadPdf() {
    if (!current || !markdown) return;
    // Downloading also saves, without waiting: the PDF doesn't depend on it.
    if (saver.dirty) void saver.save();
    setStatus("generating");
    try {
      // Loaded on demand: the PDF renderer is large and only needed here.
      const [{ pdf }, { AgreementPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/AgreementPdf"),
      ]);
      const blob = await pdf(
        <AgreementPdf name={current.spec.name} shortName={current.spec.shortName} {...markdown} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFilename(current.spec, values);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to generate the PDF", error);
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">Draft an agreement</h1>

      <div className="mx-auto flex w-full max-w-7xl shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <DocumentPicker documents={specs} value={draft.documentId} onChange={chooseDocument} disabled={chat.pending} />
        <div className="ml-auto flex items-center gap-3">
          {/* Always rendered so screen readers announce changes to its text. */}
          <p role="status" className="text-xs">
            {status === "generating" && <span className="sr-only">Generating PDF…</span>}
            {status === "error" ? (
              <span className="text-red-600">Couldn’t generate the PDF. Please try again.</span>
            ) : saver.status === "error" ? (
              <span className="text-red-600">{saver.error}</span>
            ) : (
              saver.dirty && saver.savedId !== null && <span className="text-slate-500">Unsaved changes</span>
            )}
          </p>
          <SaveButton
            disabled={!current}
            saving={saver.status === "saving"}
            saved={saver.savedId !== null && !saver.dirty}
            onClick={() => void saver.save()}
          />
          <Button
            type="button"
            onClick={downloadPdf}
            disabled={!current || status === "generating"}
            aria-busy={status === "generating"}
          >
            <DownloadIcon className="size-4" />
            {status === "generating" ? "Generating PDF…" : "Download PDF"}
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl shrink-0 px-4 pb-3 sm:px-6 lg:hidden">
        <ViewSwitch value={view} onChange={setView} />
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 grid-rows-1 gap-6 px-4 pb-4 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section
          aria-label="Document details"
          className={`${view === "edit" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:flex`}
        >
          <Tabs label="How to fill in the document" idPrefix="doc" tabs={TABS} value={tab} onChange={setTab} />

          <TabPanel idPrefix="doc" tab="chat" selected={tab === "chat"} className="flex min-h-0 flex-1 flex-col">
            <DocumentChat
              messages={chat.messages}
              pending={chat.pending}
              error={chat.error}
              complete={chat.complete}
              onSend={chat.send}
              onRetry={chat.retry}
              onStartOver={startOver}
              startOverPrompt={
                saver.savedId !== null ? "Start a new document? This one stays saved." : undefined
              }
            />
          </TabPanel>

          <TabPanel
            idPrefix="doc"
            tab="fields"
            selected={tab === "fields"}
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"
          >
            {current ? (
              <>
                <p className="mb-5 text-sm text-slate-600">
                  Check or change what the chat filled in. Blank fields keep their placeholder so they can be
                  completed by hand.
                </p>
                {current.coverPageTemplate ? (
                  <NdaForm values={values} onChange={(next) => handleChange({ ...values, ...next })} />
                ) : (
                  <AgreementForm spec={current.spec} values={values} onChange={handleChange} />
                )}
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Choose an agreement first: tell the assistant what you need, or pick one from the Document menu.
              </p>
            )}
          </TabPanel>
        </section>

        <section
          aria-label="Document preview"
          className={`${view === "preview" ? "block" : "hidden"} relative min-h-0 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10 lg:block`}
        >
          {markdown ? (
            <>
              <DraftNotice />
              <DocumentPreview {...markdown} />
            </>
          ) : (
            <DocumentChoices
              documents={specs}
              onChoose={(id) => {
                chooseDocument(id);
                setView("edit");
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/** Save, with its progress; once saved it reads "Saved" until something changes. */
function SaveButton({
  disabled,
  saving,
  saved,
  onClick,
}: {
  disabled: boolean;
  saving: boolean;
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled || saving || saved}
      aria-busy={saving}
    >
      {saved && <CheckIcon className="size-4 text-green-700" />}
      {saving ? "Saving…" : saved ? "Saved" : "Save"}
    </Button>
  );
}

/** The draft disclaimer, above the agreement in the preview. */
function DraftNotice() {
  return (
    <div
      role="note"
      className="mx-auto mb-8 flex max-w-3xl gap-3 rounded-lg border border-accent/60 bg-accent/10 px-4 py-3 font-sans text-xs leading-relaxed text-slate-800"
    >
      <ShieldIcon className="size-5 shrink-0 text-navy" />
      <p>
        <strong className="font-semibold text-navy">Draft — subject to legal review. </strong>
        {DISCLAIMER}
      </p>
    </div>
  );
}

/** Switches between the edit panel and the preview on narrow screens. */
function ViewSwitch({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  const options: { id: View; label: string }[] = [
    { id: "edit", label: "Edit" },
    { id: "preview", label: "Preview" },
  ];
  return (
    <div role="group" aria-label="Show panel" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/70 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={
            "rounded-md px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary " +
            (value === option.id ? "bg-white text-navy shadow-sm" : "text-slate-600 hover:text-navy")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
