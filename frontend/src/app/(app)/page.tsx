import type { Metadata } from "next";
import { NdaCreator } from "@/components/NdaCreator";
import { readTemplate } from "@/lib/templates";

export const metadata: Metadata = { title: "Mutual NDA Creator" };

export default function Home() {
  return (
    <NdaCreator
      coverPageTemplate={readTemplate("Mutual-NDA-coverpage.md")}
      standardTerms={readTemplate("Mutual-NDA.md")}
    />
  );
}
