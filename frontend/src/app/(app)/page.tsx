import type { Metadata } from "next";
import { DocumentCreator } from "@/components/DocumentCreator";
import { readDocuments } from "@/lib/templates";

export const metadata: Metadata = { title: "Draft an agreement" };

export default function Home() {
  return <DocumentCreator documents={readDocuments()} />;
}
