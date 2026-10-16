/**
 * Renders a filled agreement's Markdown as a PDF with @react-pdf/renderer.
 *
 * It walks the same `marked` tokens the HTML preview is built from, and
 * supports the subset of Markdown used by the Common Paper templates:
 * headings, paragraphs, nested ordered lists (numbered 1, 1.1, ...), tables,
 * bold text, links and the templates' inline `<label>`, `<span>` and `<br>` tags.
 */
import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Token, Tokens } from "marked";
import type { ReactNode } from "react";
import { lexMarkdown } from "@/lib/documents";

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 64,
    paddingHorizontal: 60,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: "#111827",
  },
  // Line heights are absolute and set below the Page: react-pdf stops drawing
  // the `render` footer when the Page has a lineHeight, and outside the Page it
  // mis-scales unitless values.
  body: { lineHeight: "14.5pt" },
  h1: { fontFamily: "Times-Bold", fontSize: 18, lineHeight: "22pt", textAlign: "center", marginBottom: 14 },
  h2: { fontFamily: "Times-Bold", fontSize: 12, lineHeight: "16pt", marginTop: 6, marginBottom: 6 },
  h3: { fontFamily: "Times-Bold", fontSize: 11.5, lineHeight: "15pt", marginTop: 10, marginBottom: 2 },
  paragraph: { marginBottom: 6 },
  bold: { fontFamily: "Times-Bold" },
  italic: { fontFamily: "Times-Italic" },
  label: { fontSize: 9, color: "#6b7280" },
  link: { color: "#1d4ed8", textDecoration: "underline" },
  listItem: { flexDirection: "row", marginBottom: 4 },
  listNumber: { width: 20 },
  nestedListNumber: { width: 30 },
  listBody: { flex: 1 },
  table: { marginTop: 8, marginBottom: 12, borderTop: "1pt solid #9ca3af", borderLeft: "1pt solid #9ca3af" },
  row: { flexDirection: "row" },
  cell: {
    flex: 1,
    padding: 5,
    minHeight: 26,
    borderRight: "1pt solid #9ca3af",
    borderBottom: "1pt solid #9ca3af",
  },
  headerCell: { fontFamily: "Times-Bold", backgroundColor: "#f3f4f6" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 60,
    right: 60,
    fontSize: 8.5,
    color: "#6b7280",
    textAlign: "center",
  },
});

/**
 * Renders inline tokens. `<label>…</label>` content is shown as muted hint
 * text, and clause headings (`<span class="header_2|header_3">`) in bold.
 */
function renderInline(tokens: Token[] = []): ReactNode[] {
  const nodes: ReactNode[] = [];
  let inLabel = false;
  // Whether each open <span> is a heading; other spans (e.g. "coverpage_link") only carry styling hooks.
  const spans: boolean[] = [];

  tokens.forEach((token, i) => {
    switch (token.type) {
      case "html": {
        const tag = token.text.trim().toLowerCase();
        if (tag.startsWith("<br")) nodes.push("\n");
        else if (tag.startsWith("<label")) inLabel = true;
        else if (tag.startsWith("</label")) inLabel = false;
        else if (tag.startsWith("<span")) spans.push(/class="header_\d"/.test(tag));
        else if (tag.startsWith("</span")) spans.pop();
        return;
      }
      case "br":
        nodes.push("\n");
        return;
      case "strong":
      case "em":
        nodes.push(
          <Text key={i} style={token.type === "strong" ? styles.bold : styles.italic}>
            {renderInline(token.tokens)}
          </Text>,
        );
        return;
      case "link":
        nodes.push(
          <Link key={i} src={token.href} style={styles.link}>
            {renderInline(token.tokens)}
          </Link>,
        );
        return;
      default: {
        // Text, escaped characters, inline code and any other leaf with text.
        const content = "tokens" in token && token.tokens ? renderInline(token.tokens) : "text" in token ? token.text : "";
        const style = inLabel ? styles.label : spans.includes(true) ? styles.bold : undefined;
        nodes.push(
          style ? (
            <Text key={i} style={style}>
              {content}
            </Text>
          ) : (
            content
          ),
        );
      }
    }
  });

  return nodes;
}

function renderTable(table: Tokens.Table, key: number) {
  const renderRow = (cells: Tokens.TableCell[], isHeader: boolean, rowKey: string) => (
    <View key={rowKey} style={styles.row}>
      {cells.map((cell, i) => (
        <View key={i} style={isHeader ? [styles.cell, styles.headerCell] : styles.cell}>
          <Text>{renderInline(cell.tokens)}</Text>
        </View>
      ))}
    </View>
  );

  return (
    // Kept on one page so the signature block is never split.
    <View key={key} style={styles.table} wrap={false}>
      {renderRow(table.header, true, "header")}
      {table.rows.map((cells, i) => renderRow(cells, false, `row-${i}`))}
    </View>
  );
}

/** `parent` is the number of the list item these blocks belong to, e.g. "1" or "1.2". */
function renderBlocks(tokens: Token[], parent = ""): ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case "space":
        return null;
      case "heading": {
        const style = token.depth === 1 ? styles.h1 : token.depth === 2 ? styles.h2 : styles.h3;
        return (
          <Text key={i} style={style} minPresenceAhead={40}>
            {renderInline(token.tokens)}
          </Text>
        );
      }
      case "list": {
        // marked's Token union includes a generic `{ type: string }` member, so
        // switching on `type` does not narrow it; the casts are required.
        const list = token as Tokens.List;
        const start = typeof list.start === "number" ? list.start : 1;
        return (
          <View key={i}>
            {list.items.map((item, j) => {
              // "1." at the top level and "1.1" when nested, as in the preview.
              const number = parent ? `${parent}.${start + j}` : `${start + j}`;
              // A single clause fits on a page, so it is never split across
              // pages; a section with sub-clauses may be.
              const isClause = !item.tokens.some((child) => child.type === "list");
              return (
                <View key={j} style={styles.listItem} wrap={!isClause}>
                  <Text style={parent ? styles.nestedListNumber : styles.listNumber}>
                    {list.ordered ? (parent ? number : `${number}.`) : "•"}
                  </Text>
                  <View style={styles.listBody}>{renderBlocks(item.tokens, number)}</View>
                </View>
              );
            })}
          </View>
        );
      }
      case "table":
        return renderTable(token as Tokens.Table, i);
      default:
        // Paragraphs, tight-list "text" blocks, and any other block with inline content.
        return (
          <Text key={i} style={styles.paragraph}>
            {"tokens" in token && token.tokens ? renderInline(token.tokens) : token.raw}
          </Text>
        );
    }
  });
}

function AgreementPage({ markdown, title }: { markdown: string; title: string }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.body}>{renderBlocks(lexMarkdown(markdown))}</View>
      <Text
        style={styles.footer}
        fixed
        render={({ pageNumber, totalPages }) => `${title} · Page ${pageNumber} of ${totalPages}`}
      />
    </Page>
  );
}

export function AgreementPdf({
  name,
  shortName,
  coverPage,
  standardTerms,
}: {
  /** The agreement's full name, e.g. "Mutual Non-Disclosure Agreement". */
  name: string;
  /** Used in the page footers, e.g. "Mutual NDA". */
  shortName: string;
  coverPage: string;
  standardTerms: string;
}) {
  return (
    <Document title={name} author="Prelegal" creator="Prelegal">
      <AgreementPage markdown={coverPage} title={`${shortName} Cover Page`} />
      <AgreementPage markdown={standardTerms} title={`${shortName} Standard Terms`} />
    </Document>
  );
}
