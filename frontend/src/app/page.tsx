import { NdaCreator } from "@/components/NdaCreator";
import { readTemplate } from "@/lib/templates";

export default function Home() {
  return (
    <NdaCreator
      coverPageTemplate={readTemplate("Mutual-NDA-coverpage.md")}
      standardTerms={readTemplate("Mutual-NDA.md")}
    />
  );
}
