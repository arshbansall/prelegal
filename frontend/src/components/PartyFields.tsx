"use client";

import { Section, TextField } from "@/components/ui/fields";
import { SHORT_TEXT_MAX, type Party } from "@/lib/nda";

/** One party's signer details, shared by every agreement's form. */
export function PartyFields({
  id,
  title,
  party,
  onChange,
}: {
  id: string;
  title: string;
  party: Party;
  onChange: (party: Party) => void;
}) {
  const set = (field: keyof Party) => (value: string) => onChange({ ...party, [field]: value });

  return (
    <Section title={title}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id={`${id}-name`} label="Print name" maxLength={SHORT_TEXT_MAX} value={party.name} onChange={set("name")} />
        <TextField id={`${id}-title`} label="Title" maxLength={SHORT_TEXT_MAX} value={party.title} onChange={set("title")} />
      </div>
      <TextField id={`${id}-company`} label="Company" maxLength={SHORT_TEXT_MAX} value={party.company} onChange={set("company")} />
      <TextField
        id={`${id}-address`}
        label="Notice address"
        hint="Use either an email or a postal address."
        rows={2}
        maxLength={SHORT_TEXT_MAX}
        value={party.noticeAddress}
        onChange={set("noticeAddress")}
      />
    </Section>
  );
}
