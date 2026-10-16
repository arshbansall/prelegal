import type { Metadata } from "next";
import { DocumentList } from "@/components/DocumentList";

export const metadata: Metadata = { title: "My documents" };

export default function DocumentsPage() {
  return <DocumentList />;
}
