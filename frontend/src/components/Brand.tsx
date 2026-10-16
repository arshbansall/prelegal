/** The Prelegal wordmark with the brand's yellow accent bar; `light` is for dark backgrounds. */
export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span
      className={`flex items-center gap-2 text-lg font-bold tracking-tight ${tone === "light" ? "text-white" : "text-navy"}`}
    >
      <span aria-hidden className="h-5 w-1.5 rounded-full bg-accent" />
      Prelegal
    </span>
  );
}
