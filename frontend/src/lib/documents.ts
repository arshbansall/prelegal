/**
 * The agreements Prelegal can draft (documents.json at the repository root,
 * also read by the backend) and the draft they share.
 *
 * The Mutual NDA fills in Common Paper's own cover page (`fillCoverPage` in
 * lib/nda.ts). Every other agreement's template is Standard Terms only, so its
 * cover page is generated here from the agreement's key `terms`.
 */
import { marked, type TokensList } from "marked";
import {
  applyNdaUpdates,
  defaultNdaValues,
  escapeMarkdown,
  fillCoverPage,
  formatDate,
  type NdaUpdates,
  type NdaValues,
} from "@/lib/nda";

/** A key term on the cover page, e.g. the Pilot Period. */
export type Term = {
  key: string;
  label: string;
  hint: string;
  required?: boolean;
  /** Pre-filled when the agreement is chosen, e.g. "None". */
  default?: string;
  /** Multi-line text. */
  long?: boolean;
};

export type DocumentSpec = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  standardTerms: string;
  /** Only the Mutual NDA has a cover page template. */
  coverPage?: string;
  /** Role labels for party1 and party2, e.g. ["Provider", "Customer"]. */
  parties: [string, string];
  effectiveDateLabel?: string;
  /** Whether the cover page has Governing Law and Chosen Courts (addenda don't). */
  governingLaw: boolean;
  terms: Term[];
};

/** An agreement with its template text, read at build time (see lib/templates.ts). */
export type AgreementDocument = {
  spec: DocumentSpec;
  standardTerms: string;
  coverPageTemplate?: string;
};

export const NDA_ID = "mutual-nda";

/**
 * The document being drafted. The parties, effective date, governing law and
 * jurisdiction are shared by every agreement; the other NDA fields apply only
 * to the NDA, and `terms` holds the other agreements' key terms by key.
 * Mirrors DocumentValues in backend/app/schemas.py.
 */
export type DocumentValues = NdaValues & { terms: Record<string, string> };

/** A partial change to a document, e.g. the fields the AI chat filled in. */
export type DocumentUpdates = NdaUpdates & { terms?: Record<string, string> };

export const emptyValues: DocumentValues = { ...defaultNdaValues, terms: {} };

export function effectiveDateLabel(spec: DocumentSpec): string {
  return spec.effectiveDateLabel ?? "Effective Date";
}

/**
 * A fresh draft of `spec` that keeps the fields every agreement shares.
 * Mirrors switch_document in backend/app/drafting.py.
 */
export function switchDocument(values: DocumentValues, spec: DocumentSpec): DocumentValues {
  const { party1, party2, effectiveDate, governingLaw, jurisdiction } = values;
  const terms = Object.fromEntries(spec.terms.map((term) => [term.key, term.default ?? ""]));
  return { ...defaultNdaValues, party1, party2, effectiveDate, governingLaw, jurisdiction, terms };
}

export function applyDocumentUpdates(values: DocumentValues, { terms, ...updates }: DocumentUpdates): DocumentValues {
  return { ...applyNdaUpdates(values, updates), terms: { ...values.terms, ...terms } };
}

const placeholder = (label: string) => `[Fill in ${label}]`;

/**
 * A Common Paper-style cover page for an agreement without a cover page
 * template: its key terms, then a signature table with a column per party.
 * User input is escaped, and blank fields show a placeholder.
 */
export function buildCoverPage(spec: DocumentSpec, values: DocumentValues): string {
  const dateLabel = effectiveDateLabel(spec);
  const section = (heading: string, body: string) => `### ${heading}\n${body}`;
  const sections = [
    section(dateLabel, escapeMarkdown(formatDate(values.effectiveDate)) || placeholder(dateLabel)),
    ...spec.terms.map((term) =>
      section(term.label, escapeMarkdown(values.terms[term.key] ?? "") || placeholder(term.label)),
    ),
  ];
  if (spec.governingLaw) {
    sections.push(
      section(
        "Governing Law & Chosen Courts",
        `Governing Law: ${escapeMarkdown(values.governingLaw) || "[Fill in state]"}\n\n` +
          `Chosen Courts: ${escapeMarkdown(values.jurisdiction) || "[Fill in city or county and state, e.g. “courts located in New Castle, DE”]"}`,
      ),
    );
  }

  const [role1, role2] = spec.parties;
  const { party1: p1, party2: p2 } = values;
  const row = (label: string, a = "", b = "") => `| ${label} | ${escapeMarkdown(a)} | ${escapeMarkdown(b)} |`;

  return [
    `# ${spec.name}`,
    "## Cover Page",
    `This ${spec.name} (the “Agreement”) consists of: (1) this Cover Page and (2) the Common Paper ` +
      `${spec.name} Standard Terms below (the “Standard Terms”). Capitalized terms on this Cover Page ` +
      "have the meanings given in the Standard Terms.",
    ...sections,
    `By signing this Cover Page, each party agrees to enter into this Agreement as of the ${dateLabel}.`,
    [
      `|| ${role1.toUpperCase()} | ${role2.toUpperCase()} |`,
      "|:--- | :----: | :----: |",
      row("Signature"),
      row("Print Name", p1.name, p2.name),
      row("Title", p1.title, p2.title),
      row("Company", p1.company, p2.company),
      row("Notice Address <label>Use either email or postal address</label>", p1.noticeAddress, p2.noticeAddress),
      row("Date"),
    ].join("\n"),
    `Common Paper ${spec.name} Standard Terms free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`,
  ].join("\n\n");
}

/** The filled cover page and the Standard Terms, as Markdown. */
export function documentMarkdown(document: AgreementDocument, values: DocumentValues) {
  const coverPage = document.coverPageTemplate
    ? fillCoverPage(document.coverPageTemplate, values)
    : buildCoverPage(document.spec, values);
  return { coverPage, standardTerms: document.standardTerms };
}

/** Markdown options shared by the preview and the PDF: a line break inside a clause is kept. */
export const markdownOptions = { breaks: true, async: false } as const;

/**
 * The agreement's Markdown tokens, for the PDF. Unlike `marked.parse`,
 * `marked.lexer` replaces the defaults (such as GFM tables) with the options it
 * is given, so they are merged here.
 */
export function lexMarkdown(markdown: string): TokensList {
  return marked.lexer(markdown, { ...marked.defaults, ...markdownOptions });
}

/** A filesystem-safe PDF filename based on the agreement and the parties' companies. */
export function pdfFilename(spec: DocumentSpec, values: DocumentValues): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [spec.shortName, values.party1.company, values.party2.company].map(slug).filter(Boolean);
  return parts.join("-") + ".pdf";
}
