/**
 * Fills the Common Paper Mutual NDA cover page template with form values.
 *
 * The cover page template (templates/Mutual-NDA-coverpage.md) is a fixed,
 * versioned document, so values are substituted by replacing exact snippets
 * of its text. If the template ever changes, `fillCoverPage` throws instead of
 * silently producing a document with unfilled placeholders.
 */

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type NdaValues = {
  purpose: string;
  /** ISO date (yyyy-mm-dd), or empty to leave the placeholder in place. */
  effectiveDate: string;
  mndaTermType: "expires" | "untilTerminated";
  mndaTermYears: string;
  confidentialityType: "years" | "perpetual";
  confidentialityYears: string;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

/** Longest single-line and multi-line field values the backend accepts (backend/app/schemas.py). */
export const SHORT_TEXT_MAX = 500;
export const LONG_TEXT_MAX = 4000;

/** A partial change to an NDA, e.g. the fields the AI chat filled in. */
export type NdaUpdates = Partial<Omit<NdaValues, "party1" | "party2">> & {
  party1?: Partial<Party>;
  party2?: Partial<Party>;
};

export function applyNdaUpdates(values: NdaValues, updates: NdaUpdates): NdaValues {
  const { party1, party2, ...fields } = updates;
  return {
    ...values,
    ...fields,
    party1: { ...values.party1, ...party1 },
    party2: { ...values.party2, ...party2 },
  };
}

/** Placeholder text exactly as it appears in the cover page template. */
const PLACEHOLDER = {
  purpose: "[Evaluating whether to enter into a business relationship with the other party.]",
  effectiveDate: "[Today’s date]",
  years: "[1 year(s)]",
  governingLaw: "[Fill in state]",
  jurisdiction: "[Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
};

export const defaultNdaValues: NdaValues = {
  purpose: PLACEHOLDER.purpose.slice(1, -1),
  effectiveDate: "",
  mndaTermType: "expires",
  mndaTermYears: "1",
  confidentialityType: "years",
  confidentialityYears: "1",
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: { name: "", title: "", company: "", noticeAddress: "" },
  party2: { name: "", title: "", company: "", noticeAddress: "" },
};

/**
 * Escapes user input so it is rendered as literal text. CommonMark allows a
 * backslash before any ASCII punctuation character, which also neutralises
 * raw HTML (`<`), entities (`&`) and table cell separators (`|`).
 * Line breaks become `<br>` so multi-line input stays inside its table cell or
 * paragraph.
 */
export function escapeMarkdown(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[!-/:-@[-`{-~]/g, "\\$&"))
    .filter(Boolean)
    .join("<br>");
}

/** Escaped input, or the template's placeholder when the input is blank. */
function valueOr(value: string, placeholder: string): string {
  return escapeMarkdown(value) || placeholder;
}

/** A term length must be a whole number of years from 1 to 999. */
export function isValidYears(years: string): boolean {
  return /^[1-9]\d{0,2}$/.test(years.trim());
}

function formatYears(years: string): string {
  if (!isValidYears(years)) return PLACEHOLDER.years;
  const n = Number(years);
  return n === 1 ? "1 year" : `${n} years`;
}

/** Formats an ISO date (yyyy-mm-dd) as e.g. "October 15, 2026". */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  // setUTCFullYear avoids Date's mapping of years 0–99 to 1900–1999, and UTC
  // avoids shifting the day across time zones.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function fillCoverPage(template: string, values: NdaValues): string {
  const mndaTerm =
    values.mndaTermType === "expires"
      ? `Expires ${formatYears(values.mndaTermYears)} from Effective Date.`
      : "Continues until terminated in accordance with the terms of the MNDA.";

  const confidentiality =
    values.confidentialityType === "years"
      ? `${formatYears(values.confidentialityYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.";

  const { party1: p1, party2: p2 } = values;
  const row = (label: string, a: string, b: string) =>
    `| ${label} | ${escapeMarkdown(a)} | ${escapeMarkdown(b)} |`;
  const noticeAddressLabel = "Notice Address <label>Use either email or postal address</label>";

  // Exact template text → replacement. The blank line after each "<label>"
  // line keeps the chosen option from being parsed as part of the label.
  const replacements = new Map<string, string>([
    [PLACEHOLDER.purpose, valueOr(values.purpose, PLACEHOLDER.purpose)],
    [PLACEHOLDER.effectiveDate, valueOr(formatDate(values.effectiveDate), PLACEHOLDER.effectiveDate)],
    [
      "<label>The length of this MNDA</label>\n" +
        "- [x]     Expires [1 year(s)] from Effective Date.\n" +
        "- [ ]     Continues until terminated in accordance with the terms of the MNDA.",
      `<label>The length of this MNDA</label>\n\n${mndaTerm}`,
    ],
    [
      "<label>How long Confidential Information is protected</label>\n" +
        "- [x]     [1 year(s)] from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.\n" +
        "- [ ]     In perpetuity.",
      `<label>How long Confidential Information is protected</label>\n\n${confidentiality}`,
    ],
    [PLACEHOLDER.governingLaw, valueOr(values.governingLaw, PLACEHOLDER.governingLaw)],
    [PLACEHOLDER.jurisdiction, valueOr(values.jurisdiction, PLACEHOLDER.jurisdiction)],
    ["List any modifications to the MNDA", valueOr(values.modifications, "None.")],
    ["| Print Name | |", row("Print Name", p1.name, p2.name)],
    ["| Title | | |", row("Title", p1.title, p2.title)],
    ["| Company | | |", row("Company", p1.company, p2.company)],
    [`| ${noticeAddressLabel} | | |`, row(noticeAddressLabel, p1.noticeAddress, p2.noticeAddress)],
  ]);

  const source = template.replace(/\r\n/g, "\n");
  for (const search of replacements.keys()) {
    if (!source.includes(search)) {
      throw new Error(`Mutual NDA cover page template is missing expected text: "${search}"`);
    }
  }

  // One pass over the original template, so text inserted from user input is
  // never itself matched by a later replacement.
  const pattern = new RegExp(
    [...replacements.keys()].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g",
  );
  return source.replace(pattern, (match) => replacements.get(match)!);
}

/** A filesystem-safe PDF filename based on the parties' companies. */
export function pdfFilename(values: NdaValues): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [values.party1.company, values.party2.company].map(slug).filter(Boolean);
  return ["Mutual-NDA", ...parts].join("-") + ".pdf";
}
