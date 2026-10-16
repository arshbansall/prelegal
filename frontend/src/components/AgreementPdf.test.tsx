import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { AgreementPdf } from "@/components/AgreementPdf";
import { documentMarkdown, emptyValues, switchDocument } from "@/lib/documents";
import { readDocuments } from "@/lib/templates";

describe("AgreementPdf", () => {
  it.each(readDocuments().map((document) => [document.spec.id, document] as const))(
    "renders the %s to a PDF",
    async (_, document) => {
      const values = {
        ...switchDocument(emptyValues, document.spec),
        effectiveDate: "2026-10-15",
        governingLaw: "Delaware",
        party1: { name: "Ada", title: "CEO", company: "Acme", noticeAddress: "ada@acme.com\n1 Main St" },
      };

      const pdf = await renderToBuffer(
        <AgreementPdf
          name={document.spec.name}
          shortName={document.spec.shortName}
          {...documentMarkdown(document, values)}
        />,
      );

      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(5000);
    },
  );
});
