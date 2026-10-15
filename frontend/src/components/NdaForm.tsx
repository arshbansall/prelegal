"use client";

import type { ReactNode } from "react";
import { isValidYears, type NdaValues, type Party } from "@/lib/nda";

const controlClass =
  "rounded-md border border-slate-300 bg-white text-sm text-slate-900 shadow-sm " +
  "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 " +
  "disabled:bg-slate-100 disabled:text-slate-400 aria-invalid:border-red-500";

const legendClass = "text-sm font-medium text-slate-700";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  rows,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** Renders a textarea with this many rows instead of a single-line input. */
  rows?: number;
}) {
  const props = {
    id,
    value,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-describedby": hint ? `${id}-hint` : undefined,
    className: `${controlClass} w-full px-3 py-2`,
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className={legendClass}>
        {label}
      </label>
      {rows ? <textarea rows={rows} {...props} /> : <input autoComplete="off" {...props} />}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A two-option term choice: a whole number of years, or an open-ended
 * alternative ("until terminated", "in perpetuity").
 */
function TermChoice<T extends string>({
  id,
  legend,
  value,
  onChange,
  years,
  onYearsChange,
  yearsOption,
  otherOption,
  hint,
}: {
  id: string;
  legend: string;
  value: T;
  onChange: (value: T) => void;
  years: string;
  onYearsChange: (years: string) => void;
  yearsOption: { value: T; label: string };
  otherOption: { value: T; label: string };
  hint?: string;
}) {
  const usesYears = value === yearsOption.value;
  const invalid = usesYears && !isValidYears(years);

  return (
    <fieldset className="space-y-2">
      <legend className={legendClass}>{legend}</legend>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <input
          type="radio"
          id={`${id}-years`}
          name={id}
          checked={usesYears}
          onChange={() => onChange(yearsOption.value)}
          className="accent-indigo-600"
        />
        <label htmlFor={`${id}-years`}>{yearsOption.label}</label>
        <input
          type="number"
          min={1}
          max={999}
          step={1}
          inputMode="numeric"
          aria-label={`${legend} in years`}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          value={years}
          disabled={!usesYears}
          onChange={(e) => onYearsChange(e.target.value)}
          className={`${controlClass} w-20 px-2 py-1`}
        />
        <span aria-hidden>year(s)</span>
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-xs text-red-600">
          Enter a whole number of years (1–999).
        </p>
      )}
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="radio"
          id={`${id}-other`}
          name={id}
          checked={!usesYears}
          onChange={() => onChange(otherOption.value)}
          className="accent-indigo-600"
        />
        <label htmlFor={`${id}-other`}>{otherOption.label}</label>
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </fieldset>
  );
}

function PartyFields({
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
        <TextField id={`${id}-name`} label="Print name" value={party.name} onChange={set("name")} />
        <TextField id={`${id}-title`} label="Title" value={party.title} onChange={set("title")} />
      </div>
      <TextField id={`${id}-company`} label="Company" value={party.company} onChange={set("company")} />
      <TextField
        id={`${id}-address`}
        label="Notice address"
        hint="Use either an email or a postal address."
        rows={2}
        value={party.noticeAddress}
        onChange={set("noticeAddress")}
      />
    </Section>
  );
}

export function NdaForm({
  values,
  onChange,
}: {
  values: NdaValues;
  onChange: (values: NdaValues) => void;
}) {
  const set =
    <K extends keyof NdaValues>(key: K) =>
    (value: NdaValues[K]) =>
      onChange({ ...values, [key]: value });

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <Section title="Agreement terms">
        <TextField
          id="purpose"
          label="Purpose"
          hint="How Confidential Information may be used."
          rows={3}
          value={values.purpose}
          onChange={set("purpose")}
        />

        <div className="space-y-1">
          <label htmlFor="effectiveDate" className={legendClass}>
            Effective date
          </label>
          <input
            id="effectiveDate"
            type="date"
            className={`${controlClass} w-full px-3 py-2`}
            value={values.effectiveDate}
            onChange={(e) => set("effectiveDate")(e.target.value)}
          />
        </div>

        <TermChoice
          id="mndaTerm"
          legend="MNDA term"
          value={values.mndaTermType}
          onChange={set("mndaTermType")}
          years={values.mndaTermYears}
          onYearsChange={set("mndaTermYears")}
          yearsOption={{ value: "expires", label: "Expires after" }}
          otherOption={{ value: "untilTerminated", label: "Continues until terminated" }}
        />

        <TermChoice
          id="confidentiality"
          legend="Term of confidentiality"
          value={values.confidentialityType}
          onChange={set("confidentialityType")}
          years={values.confidentialityYears}
          onYearsChange={set("confidentialityYears")}
          yearsOption={{ value: "years", label: "Protected for" }}
          otherOption={{ value: "perpetual", label: "In perpetuity" }}
          hint="Trade secrets stay protected for as long as they remain trade secrets."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="governingLaw"
            label="Governing law"
            hint="State, e.g. Delaware."
            value={values.governingLaw}
            onChange={set("governingLaw")}
          />
          <TextField
            id="jurisdiction"
            label="Jurisdiction"
            hint="e.g. courts located in New Castle, DE."
            value={values.jurisdiction}
            onChange={set("jurisdiction")}
          />
        </div>

        <TextField
          id="modifications"
          label="MNDA modifications"
          hint="Optional. Leave blank if there are none."
          rows={3}
          value={values.modifications}
          onChange={set("modifications")}
        />
      </Section>

      <PartyFields id="party1" title="Party 1" party={values.party1} onChange={set("party1")} />
      <PartyFields id="party2" title="Party 2" party={values.party2} onChange={set("party2")} />
    </form>
  );
}
