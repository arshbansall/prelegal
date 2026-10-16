import type { Metadata } from "next";
import { Suspense } from "react";
import { DraftPage } from "@/components/DraftPage";
import { PageSpinner } from "@/components/ui/layout";
import { readDocuments } from "@/lib/templates";

export const metadata: Metadata = { title: "Draft an agreement" };

/** /draft/ starts a new document; /draft/?id=N resumes a saved one. */
export default function Draft() {
  return (
    // DraftPage reads the query string, which is only known in the browser.
    <Suspense fallback={<PageSpinner />}>
      <DraftPage documents={readDocuments()} />
    </Suspense>
  );
}
