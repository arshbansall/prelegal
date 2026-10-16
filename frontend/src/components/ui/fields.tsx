import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Base styling shared by text inputs, textareas and other form controls. */
export const controlClass =
  "rounded-md border border-slate-300 bg-white text-sm text-slate-900 shadow-sm " +
  "focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy " +
  "disabled:bg-slate-100 disabled:text-slate-400 aria-invalid:border-red-500";

export const labelClass = "text-sm font-medium text-navy";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

export function TextField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  rows,
  type = "text",
  autoComplete = "off",
  required,
}: {
  id: string;
  label: string;
  hint?: string;
  /** Validation message; marks the control invalid when set. */
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** Renders a textarea with this many rows instead of a single-line input. */
  rows?: number;
  type?: "text" | "email" | "password" | "date";
  autoComplete?: string;
  required?: boolean;
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  const props = {
    id,
    value,
    required,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
    className: `${controlClass} w-full px-3 py-2`,
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {rows ? (
        <textarea rows={rows} {...props} />
      ) : (
        <input type={type} autoComplete={autoComplete} {...props} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const buttonVariants = {
  /** Submit and primary actions use the brand's purple. */
  primary:
    "bg-secondary text-white shadow-sm hover:bg-secondary/90 focus-visible:outline-secondary",
  /** Low-emphasis actions such as Sign out. */
  ghost: "text-navy hover:bg-slate-100 focus-visible:outline-primary",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      {...props}
      className={
        "rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 " +
        "focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 " +
        `${buttonVariants[variant]} ${className}`
      }
    />
  );
}
