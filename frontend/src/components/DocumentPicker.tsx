"use client";

import { controlClass } from "@/components/ui/fields";
import type { DocumentSpec } from "@/lib/documents";

/** A menu of the agreements, for switching without the chat. */
export function DocumentPicker({
  documents,
  value,
  onChange,
  disabled,
}: {
  documents: DocumentSpec[];
  value: string | null;
  onChange: (documentId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="document-picker" className="shrink-0 text-sm font-medium text-slate-600">
        Document
      </label>
      <select
        id="document-picker"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} min-w-0 py-1.5 pl-2 pr-8 font-semibold text-navy`}
      >
        {value === null && (
          <option value="" disabled>
            Choose an agreement…
          </option>
        )}
        {documents.map((spec) => (
          <option key={spec.id} value={spec.id}>
            {spec.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Shown in place of the preview until an agreement is chosen. */
export function DocumentChoices({
  documents,
  onChoose,
}: {
  documents: DocumentSpec[];
  onChoose: (documentId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-lg font-semibold text-navy">Your agreement will appear here</h2>
      <p className="mt-1 text-sm text-slate-600">
        Tell the assistant what you need, or pick an agreement to start with.
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {documents.map((spec) => (
          <li key={spec.id}>
            <button
              type="button"
              onClick={() => onChoose(spec.id)}
              className="h-full w-full rounded-md border border-slate-200 p-4 text-left transition hover:border-primary hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="block text-sm font-semibold text-navy">{spec.name}</span>
              <span className="mt-1 block text-xs text-slate-600">{spec.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
