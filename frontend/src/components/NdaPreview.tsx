import { marked } from "marked";

/**
 * Renders the filled NDA Markdown as HTML.
 *
 * Injecting the HTML is safe because the only raw HTML comes from the trusted
 * Common Paper templates; user input is escaped by `fillCoverPage`.
 */
export function NdaPreview({ coverPage, standardTerms }: { coverPage: string; standardTerms: string }) {
  return (
    <article className="nda-document">
      <section dangerouslySetInnerHTML={{ __html: marked.parse(coverPage, { async: false }) }} />
      <hr />
      <section dangerouslySetInnerHTML={{ __html: marked.parse(standardTerms, { async: false }) }} />
    </article>
  );
}
