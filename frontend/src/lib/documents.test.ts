import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyDocumentUpdates,
  buildCoverPage,
  documentMarkdown,
  emptyValues,
  lexMarkdown,
  NDA_ID,
  pdfFilename,
  switchDocument,
  type DocumentValues,
} from "@/lib/documents";
import { readDocuments } from "@/lib/templates";

const documents = readDocuments();
const find = (id: string) => documents.find((document) => document.spec.id === id)!;
const pilot = find("pilot");
const sla = find("sla");

const pilotValues: DocumentValues = {
  ...switchDocument(emptyValues, pilot.spec),
  effectiveDate: "2026-10-15",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  party1: { name: "Ada Lovelace", title: "CEO", company: "Initech", noticeAddress: "ada@initech.com" },
  party2: { name: "Alan Turing", title: "", company: "Globex", noticeAddress: "" },
  terms: { product: "Initech Analytics", pilotPeriod: "60 days", generalCapAmount: "" },
};

describe("readDocuments", () => {
  it("covers every template in catalog.json", () => {
    const catalog: { filename: string }[] = JSON.parse(readFileSync("../catalog.json", "utf-8"));
    const used = documents.flatMap(({ spec }) => [spec.standardTerms, ...(spec.coverPage ? [spec.coverPage] : [])]);
    expect(used.sort()).toEqual(catalog.map((entry) => entry.filename).sort());
  });

  it("loads the template text, and a cover page template only for the NDA", () => {
    expect(pilot.standardTerms).toMatch(/^# Pilot Agreement/);
    expect(documents.filter((document) => document.coverPageTemplate).map(({ spec }) => spec.id)).toEqual([NDA_ID]);
  });
});

describe("buildCoverPage", () => {
  const coverPage = buildCoverPage(pilot.spec, pilotValues);

  it("lists the key terms, with a placeholder for blank ones", () => {
    expect(coverPage).toContain("### Effective Date\nOctober 15\\, 2026"); // escaped Markdown
    expect(coverPage).toContain("### Pilot Period\n60 days");
    expect(coverPage).toContain("### General Cap Amount\n[Fill in General Cap Amount]");
    expect(coverPage).toContain("Governing Law: Delaware");
    expect(coverPage).toContain("Chosen Courts: courts located in New Castle\\, DE");
  });

  it("has a signature table with a column per party role", () => {
    expect(coverPage).toContain("|| PROVIDER | CUSTOMER |");
    expect(coverPage).toContain("| Print Name | Ada Lovelace | Alan Turing |");
    expect(coverPage).toContain("| Company | Initech | Globex |");
  });

  it("escapes user input", () => {
    const page = buildCoverPage(pilot.spec, { ...pilotValues, terms: { product: "<b>Evil</b> | *x*" } });
    expect(page).toContain("### Product\n\\<b\\>Evil\\<\\/b\\> \\| \\*x\\*");
  });

  it("leaves out governing law for addenda and uses their labels", () => {
    const page = buildCoverPage(sla.spec, switchDocument(pilotValues, sla.spec));
    expect(page).not.toContain("Governing Law");
    expect(page).toContain("### Target Uptime\n[Fill in Target Uptime]");

    const baa = find("baa");
    expect(buildCoverPage(baa.spec, emptyValues)).toContain("### BAA Effective Date\n[Fill in BAA Effective Date]");
  });
});

describe("documentMarkdown", () => {
  it("fills the NDA's own cover page template", () => {
    const nda = find(NDA_ID);
    const { coverPage, standardTerms } = documentMarkdown(nda, { ...emptyValues, governingLaw: "Delaware" });
    expect(coverPage).toContain("Governing Law: Delaware");
    expect(coverPage).toContain("USING THIS MUTUAL NON-DISCLOSURE AGREEMENT");
    expect(standardTerms).toBe(nda.standardTerms);
  });

  it("generates the other agreements' cover pages", () => {
    expect(documentMarkdown(pilot, pilotValues).coverPage).toBe(buildCoverPage(pilot.spec, pilotValues));
  });
});

describe("switchDocument", () => {
  it("keeps the shared fields and resets the rest to the new agreement's defaults", () => {
    const nda: DocumentValues = { ...pilotValues, purpose: "Exploring a deal.", mndaTermType: "untilTerminated" };

    const csa = switchDocument(nda, find("csa").spec);

    expect(csa.party1).toEqual(nda.party1);
    expect(csa.governingLaw).toBe("Delaware");
    expect(csa.effectiveDate).toBe("2026-10-15");
    expect(csa.mndaTermType).toBe("expires");
    expect(csa.purpose).toBe(emptyValues.purpose);
    expect(csa.terms.dpa).toBe("None");
    expect(csa.terms.cloudService).toBe("");
    expect(csa.terms).not.toHaveProperty("pilotPeriod");
    expect(switchDocument(csa, find(NDA_ID).spec).terms).toEqual({});
  });
});

describe("applyDocumentUpdates", () => {
  it("merges terms and parties and keeps everything else", () => {
    const result = applyDocumentUpdates(pilotValues, {
      terms: { generalCapAmount: "$10,000" },
      party2: { noticeAddress: "alan@globex.com" },
    });

    expect(result.terms).toEqual({ ...pilotValues.terms, generalCapAmount: "$10,000" });
    expect(result.party2).toEqual({ ...pilotValues.party2, noticeAddress: "alan@globex.com" });
    expect(result.party1).toEqual(pilotValues.party1);
    expect(applyDocumentUpdates(pilotValues, {})).toEqual(pilotValues);
  });
});

describe("pdfFilename", () => {
  it("includes the agreement and the parties' companies", () => {
    expect(pdfFilename(find(NDA_ID).spec, pilotValues)).toBe("Mutual-NDA-Initech-Globex.pdf");
    expect(pdfFilename(pilot.spec, emptyValues)).toBe("Pilot-Agreement.pdf");
  });
});

describe("lexMarkdown", () => {
  const types = (markdown: string) => lexMarkdown(markdown).map((token) => token.type);

  it("parses the signature tables, as GFM tables", () => {
    expect(types(documentMarkdown(find(NDA_ID), emptyValues).coverPage)).toContain("table");
    expect(types(buildCoverPage(pilot.spec, pilotValues))).toContain("table");
  });

  it("keeps line breaks inside a clause, e.g. before lettered sub-clauses", () => {
    expect(JSON.stringify(lexMarkdown(pilot.standardTerms))).toContain('"type":"br"');
  });
});
