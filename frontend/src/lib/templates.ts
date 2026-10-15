import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The repository-level `templates/` directory (see catalog.json) is the single
 * source of truth for agreement text. Files are read synchronously so the page
 * that uses them is prerendered at build time.
 */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

export function readTemplate(filename: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8");
}
