import type { ReactNode } from "react";

/** A loading indicator; `label` is announced to screen readers. */
export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span role={label ? "status" : undefined} className={`inline-flex items-center ${className}`}>
      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-primary motion-reduce:animate-none"
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** A spinner in the middle of the page, while the page itself loads. */
export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <Spinner label={label} />
    </div>
  );
}

/** A placeholder block shown while content loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-slate-200 motion-reduce:animate-none ${className}`} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

/** A page's title, description and main actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Shown in place of a list with nothing in it yet. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent/15 text-navy">{icon}</div>}
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const calloutTones = {
  /** The draft disclaimer and other things to keep in mind. */
  notice: "border-accent/60 bg-accent/10 text-slate-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

/** A highlighted note, such as the draft disclaimer or an error. */
export function Callout({
  tone = "notice",
  title,
  className = "",
  children,
}: {
  tone?: keyof typeof calloutTones;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "note"}
      className={`rounded-lg border px-4 py-3 text-sm ${calloutTones[tone]} ${className}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-0.5" : undefined}>{children}</div>
    </div>
  );
}
