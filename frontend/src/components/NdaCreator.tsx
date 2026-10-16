"use client";

import { useState, useSyncExternalStore } from "react";
import { NdaChat } from "@/components/NdaChat";
import { NdaForm } from "@/components/NdaForm";
import { NdaPreview } from "@/components/NdaPreview";
import { useNdaChat } from "@/components/useNdaChat";
import { Button } from "@/components/ui/fields";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import {
  applyNdaUpdates,
  defaultNdaValues,
  fillCoverPage,
  pdfFilename,
  type NdaUpdates,
  type NdaValues,
} from "@/lib/nda";

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

const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "fields", label: "Fields" },
];

export function NdaCreator({
  coverPageTemplate,
  standardTerms,
}: {
  coverPageTemplate: string;
  standardTerms: string;
}) {
  const [values, setValues] = useState<NdaValues>(defaultNdaValues);
  const [dateEdited, setDateEdited] = useState(false);
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [tab, setTab] = useState<Tab>("chat");
  const today = useToday();

  // The Effective Date follows today until the user (or the AI) changes it
  // (clearing it leaves the template's placeholder).
  const resolvedValues = { ...values, effectiveDate: dateEdited ? values.effectiveDate : today };
  const coverPage = fillCoverPage(coverPageTemplate, resolvedValues);

  function handleChange(next: NdaValues) {
    if (next.effectiveDate !== resolvedValues.effectiveDate) setDateEdited(true);
    setValues(next);
  }

  // Applied to the latest state, so edits made while the AI was replying are kept.
  function applyUpdates(updates: NdaUpdates) {
    if (updates.effectiveDate !== undefined) setDateEdited(true);
    setValues((current) => applyNdaUpdates(current, updates));
  }

  const chat = useNdaChat({ values: resolvedValues, today, onUpdates: applyUpdates });

  function startOver() {
    chat.reset();
    setValues(defaultNdaValues);
    setDateEdited(false);
  }

  async function downloadPdf() {
    setStatus("generating");
    try {
      // Loaded on demand: the PDF renderer is large and only needed here.
      const [{ pdf }, { NdaPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/NdaPdfDocument"),
      ]);
      const blob = await pdf(
        <NdaPdfDocument coverPage={coverPage} standardTerms={standardTerms} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFilename(resolvedValues);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to generate the NDA PDF", error);
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <h1 className="text-xl font-semibold text-navy">Mutual NDA Creator</h1>
        <div className="flex flex-col items-end gap-1">
          <Button type="button" onClick={downloadPdf} disabled={status === "generating"} aria-busy={status === "generating"}>
            {status === "generating" ? "Generating PDF…" : "Download PDF"}
          </Button>
          {/* Always rendered so screen readers announce changes to its text. */}
          <p role="status" className="min-h-4 text-xs text-red-600">
            {status === "generating" && <span className="sr-only">Generating PDF…</span>}
            {status === "error" && "Couldn’t generate the PDF. Please try again."}
          </p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 pb-6 pt-2 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section
          aria-label="NDA details"
          className="flex h-[36rem] flex-col rounded-lg border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:self-start"
        >
          <Tabs label="How to fill in the NDA" idPrefix="nda" tabs={TABS} value={tab} onChange={setTab} />

          <TabPanel idPrefix="nda" tab="chat" selected={tab === "chat"} className="flex min-h-0 flex-1 flex-col">
            <NdaChat
              messages={chat.messages}
              pending={chat.pending}
              error={chat.error}
              complete={chat.complete}
              onSend={chat.send}
              onRetry={chat.retry}
              onStartOver={startOver}
            />
          </TabPanel>

          <TabPanel idPrefix="nda" tab="fields" selected={tab === "fields"} className="min-h-0 flex-1 overflow-y-auto p-5">
            <p className="mb-5 text-sm text-slate-600">
              Check or change what the chat filled in. Blank fields keep their placeholder so they can be
              completed by hand.
            </p>
            <NdaForm values={resolvedValues} onChange={handleChange} />
          </TabPanel>
        </section>

        <section
          aria-label="NDA preview"
          className="rounded-lg border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10"
        >
          <NdaPreview coverPage={coverPage} standardTerms={standardTerms} />
        </section>
      </div>
    </div>
  );
}
