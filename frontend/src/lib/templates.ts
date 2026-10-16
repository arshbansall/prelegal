import { readFileSync } from "node:fs";
import path from "node:path";
import type { AgreementDocument, DocumentSpec } from "@/lib/documents";

/**
 * The repository-level `templates/` directory (see catalog.json) is the single
 * source of truth for agreement text, and `documents.json` defines the
 * agreements built from it. Files are read synchronously so the page that
 * uses them is prerendered at build time.
 */
const REPO_DIR = path.join(process.cwd(), "..");
const TEMPLATES_DIR = path.join(REPO_DIR, "templates");

export function readTemplate(filename: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8");
}

/** Every agreement in documents.json, with its template text. */
export function readDocuments(): AgreementDocument[] {
  const specs: DocumentSpec[] = JSON.parse(readFileSync(path.join(REPO_DIR, "documents.json"), "utf-8"));
  return specs.map((spec) => ({
    spec,
    standardTerms: readTemplate(spec.standardTerms),
    coverPageTemplate: spec.coverPage && readTemplate(spec.coverPage),
  }));
}
