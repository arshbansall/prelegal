"use client";

import { PartyFields } from "@/components/PartyFields";
import { Section, TextField } from "@/components/ui/fields";
import { effectiveDateLabel, type DocumentSpec, type DocumentValues } from "@/lib/documents";
import { LONG_TEXT_MAX, SHORT_TEXT_MAX } from "@/lib/nda";

/** The cover page fields of an agreement defined in documents.json (every agreement but the NDA). */
export function AgreementForm({
  spec,
  values,
  onChange,
}: {
  spec: DocumentSpec;
  values: DocumentValues;
  onChange: (values: DocumentValues) => void;
}) {
  const set =
    <K extends keyof DocumentValues>(key: K) =>
    (value: DocumentValues[K]) =>
      onChange({ ...values, [key]: value });
  const setTerm = (key: string) => (value: string) => onChange({ ...values, terms: { ...values.terms, [key]: value } });
  const [role1, role2] = spec.parties;

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <Section title="Key terms">
        <TextField
          id="effectiveDate"
          label={effectiveDateLabel(spec)}
          type="date"
          value={values.effectiveDate}
          onChange={set("effectiveDate")}
        />

        {spec.terms.map((term) => (
          <TextField
            key={term.key}
            id={`term-${term.key}`}
            label={term.required ? term.label : `${term.label} (optional)`}
            hint={term.hint}
            rows={term.long ? 3 : undefined}
            maxLength={term.long ? LONG_TEXT_MAX : SHORT_TEXT_MAX}
            value={values.terms[term.key] ?? ""}
            onChange={setTerm(term.key)}
          />
        ))}

        {spec.governingLaw && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="governingLaw"
              label="Governing law"
              hint="State, e.g. Delaware."
              maxLength={SHORT_TEXT_MAX}
              value={values.governingLaw}
              onChange={set("governingLaw")}
            />
            <TextField
              id="jurisdiction"
              label="Chosen courts"
              hint="e.g. courts located in New Castle, DE."
              maxLength={SHORT_TEXT_MAX}
              value={values.jurisdiction}
              onChange={set("jurisdiction")}
            />
          </div>
        )}
      </Section>

      <PartyFields id="party1" title={role1} party={values.party1} onChange={set("party1")} />
      <PartyFields id="party2" title={role2} party={values.party2} onChange={set("party2")} />
    </form>
  );
}
