import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { NdaPdfDocument } from "@/components/NdaPdfDocument";
import { defaultNdaValues, fillCoverPage } from "@/lib/nda";
import { readTemplate } from "@/lib/templates";

describe("NdaPdfDocument", () => {
  it("renders the filled templates to a PDF", async () => {
    const coverPage = fillCoverPage(readTemplate("Mutual-NDA-coverpage.md"), {
      ...defaultNdaValues,
      effectiveDate: "2026-10-15",
      governingLaw: "Delaware",
      party1: { name: "Ada", title: "CEO", company: "Acme", noticeAddress: "ada@acme.com\n1 Main St" },
    });

    const pdf = await renderToBuffer(
      <NdaPdfDocument coverPage={coverPage} standardTerms={readTemplate("Mutual-NDA.md")} />,
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
