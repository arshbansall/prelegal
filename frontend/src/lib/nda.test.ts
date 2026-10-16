import { marked, type Tokens } from "marked";
import { describe, expect, it } from "vitest";
import {
  applyNdaUpdates,
  defaultNdaValues,
  escapeMarkdown,
  fillCoverPage,
  formatDate,
  isValidYears,
  type NdaValues,
} from "@/lib/nda";
import { readTemplate } from "@/lib/templates";

const template = readTemplate("Mutual-NDA-coverpage.md");
const fill = (overrides: Partial<NdaValues> = {}) =>
  fillCoverPage(template, { ...defaultNdaValues, ...overrides });

const completeValues: NdaValues = {
  ...defaultNdaValues,
  purpose: "Exploring a joint product launch.",
  effectiveDate: "2026-10-15",
  mndaTermYears: "2",
  confidentialityYears: "3",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "Section 6 does not apply to source code.",
  party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.com" },
  party2: { name: "Alan Turing", title: "CTO", company: "Beta LLC", noticeAddress: "1 Main St\nDover, DE" },
};

/** Visible text of the rendered cover page. */
const renderedText = (markdown: string) =>
  marked
    .parse(markdown, { async: false })
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("fillCoverPage", () => {
  it("fills every placeholder when the form is complete", () => {
    const text = renderedText(fillCoverPage(template, completeValues));

    expect(text).toContain("Exploring a joint product launch.");
    expect(text).toContain("October 15, 2026");
    expect(text).toContain("Expires 2 years from Effective Date.");
    expect(text).toContain("3 years from Effective Date, but in the case of trade secrets");
    expect(text).toContain("Governing Law: Delaware");
    expect(text).toContain("Jurisdiction: courts located in New Castle, DE");
    expect(text).toContain("Section 6 does not apply to source code.");
    for (const value of ["Ada Lovelace", "Alan Turing", "CEO", "CTO", "Acme Inc.", "Beta LLC", "ada@acme.com"]) {
      expect(text).toContain(value);
    }
    expect(text).toContain("1 Main St Dover, DE");
    // No template placeholders or checkbox options remain.
    expect(text).not.toMatch(/\[[^\]]*\]/);
    expect(text).not.toContain("List any modifications");
  });

  it("keeps template placeholders for blank fields", () => {
    const text = renderedText(fill({ purpose: " ", mndaTermYears: "", confidentialityYears: "0" }));

    expect(text).toContain("[Evaluating whether to enter into a business relationship with the other party.]");
    expect(text).toContain("[Today’s date]");
    expect(text).toContain("Expires [1 year(s)] from Effective Date.");
    expect(text).toContain("[1 year(s)] from Effective Date, but in the case of trade secrets");
    expect(text).toContain("Governing Law: [Fill in state]");
    expect(text).toContain("Jurisdiction: [Fill in city or county and state");
    expect(text).toContain("None.");
  });

  it("shows only the selected term options", () => {
    const text = renderedText(fill({ mndaTermType: "untilTerminated", confidentialityType: "perpetual" }));

    expect(text).toContain("Continues until terminated in accordance with the terms of the MNDA.");
    expect(text).not.toContain("Expires");
    expect(text).toContain("In perpetuity.");
    expect(text).not.toContain("trade secrets");
  });

  it("uses the singular for a one-year term", () => {
    expect(renderedText(fill({ mndaTermYears: "1" }))).toContain("Expires 1 year from Effective Date.");
  });

  it("keeps the party table intact", () => {
    const table = marked
      .lexer(fillCoverPage(template, completeValues))
      .find((t): t is Tokens.Table => t.type === "table");
    if (!table) throw new Error("Cover page has no table");

    const rows = table.rows.map((cells) => cells.map((cell) => cell.text));
    expect(rows.map((cells) => cells.length)).toEqual([3, 3, 3, 3, 3, 3]);
    expect(rows[1]).toEqual(["Print Name", "Ada Lovelace", "Alan Turing"]);
    expect(rows[0].slice(1)).toEqual(["", ""]); // Signature lines stay blank.
    expect(rows[5].slice(1)).toEqual(["", ""]); // Date lines stay blank.
  });

  it("renders user input as literal text", () => {
    const html = marked.parse(
      fill({
        governingLaw: '<img src=x onerror="alert(1)"> **bold** [link](https://evil.example) &copy;',
        party1: { ...defaultNdaValues.party1, company: "Pipe | Co" },
      }),
      { async: false },
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<strong>bold");
    expect(html).not.toContain('href="https://evil.example"');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; **bold** [link](https://evil.example) &amp;copy;");
    expect(html).toContain("Pipe | Co");
  });

  it("never re-matches template text that appears in user input", () => {
    const text = renderedText(fill({ purpose: "List any modifications to the MNDA", modifications: "" }));

    expect(text).toContain("How Confidential Information may be used List any modifications to the MNDA");
    expect(text).toContain("MNDA Modifications None.");
  });

  it("throws if the template no longer matches", () => {
    expect(() => fillCoverPage("# Some other document", defaultNdaValues)).toThrow(/missing expected text/);
  });
});

describe("escapeMarkdown", () => {
  it("joins non-empty lines with <br>", () => {
    expect(escapeMarkdown("  line one \n\n line two\r\n")).toBe("line one<br>line two");
  });
});

describe("formatDate", () => {
  it("formats ISO dates without shifting the day", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("keeps years below 100 instead of mapping them to the 1900s", () => {
    expect(formatDate("0020-03-04")).toBe("March 4, 20");
  });

  it("returns an empty string for blank or invalid input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not-a-date")).toBe("");
  });
});

describe("isValidYears", () => {
  it("accepts whole numbers from 1 to 999", () => {
    for (const years of ["1", "12", "999", " 3 "]) expect(isValidYears(years)).toBe(true);
  });

  it("rejects blank, zero, fractional and oversized values", () => {
    for (const years of ["", "0", "01", "2.5", "-1", "1e21", "1000"]) expect(isValidYears(years)).toBe(false);
  });
});

describe("applyNdaUpdates", () => {
  it("changes only the given fields", () => {
    const result = applyNdaUpdates(completeValues, { governingLaw: "California", confidentialityType: "perpetual" });
    expect(result).toEqual({ ...completeValues, governingLaw: "California", confidentialityType: "perpetual" });
  });

  it("merges party details without touching the other fields or party", () => {
    const result = applyNdaUpdates(completeValues, { party1: { title: "President" } });
    expect(result.party1).toEqual({ ...completeValues.party1, title: "President" });
    expect(result.party2).toEqual(completeValues.party2);
  });

  it("clears fields set to an empty string", () => {
    expect(applyNdaUpdates(completeValues, { modifications: "" }).modifications).toBe("");
  });

  it("returns an equal copy for no updates and never mutates its input", () => {
    const before = structuredClone(completeValues);
    const result = applyNdaUpdates(completeValues, {});
    applyNdaUpdates(completeValues, { purpose: "x", party2: { name: "y" } });
    expect(result).toEqual(before);
    expect(completeValues).toEqual(before);
  });
});
