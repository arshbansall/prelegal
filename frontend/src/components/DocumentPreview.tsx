import { marked } from "marked";
import { markdownOptions } from "@/lib/documents";

/**
 * Renders the filled agreement Markdown as HTML.
 *
 * Injecting the HTML is safe because the only raw HTML comes from the trusted
 * Common Paper templates; user input is escaped when the cover page is filled
 * in (`fillCoverPage` and `buildCoverPage`).
 */
export function DocumentPreview({ coverPage, standardTerms }: { coverPage: string; standardTerms: string }) {
  return (
    <article className="agreement-document">
      <section dangerouslySetInnerHTML={{ __html: marked.parse(coverPage, markdownOptions) }} />
      <hr />
      <section dangerouslySetInnerHTML={{ __html: marked.parse(standardTerms, markdownOptions) }} />
    </article>
  );
}
