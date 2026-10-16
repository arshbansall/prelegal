import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { LandingNav } from "@/components/landing/LandingNav";
import { buttonClass } from "@/components/ui/fields";
import { ArrowRightIcon, ChatIcon, CheckIcon, DocumentIcon, DownloadIcon, ShieldIcon } from "@/components/ui/icons";
import { DISCLAIMER } from "@/lib/disclaimer";
import { readDocuments } from "@/lib/templates";

export const metadata: Metadata = {
  title: { absolute: "Prelegal · Draft legal agreements with AI" },
};

const STEPS = [
  {
    icon: ChatIcon,
    title: "Describe what you need",
    body: "Tell the assistant about the deal in plain English. It picks the right agreement and asks for anything missing.",
  },
  {
    icon: DocumentIcon,
    title: "Watch it come together",
    body: "Every answer fills in the agreement live. Check the details in the preview, or edit any field by hand.",
  },
  {
    icon: DownloadIcon,
    title: "Save and download",
    body: "Save drafts to come back to later, and download a clean PDF ready for review and signature.",
  },
];

/** The public home page. Signed-in users get a link back to their documents. */
export default function LandingPage() {
  const agreements = readDocuments().map((document) => document.spec);

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6">
          <Link href="/" className="rounded-sm focus-visible:outline-2 focus-visible:outline-primary">
            <Brand />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#how-it-works" className="rounded-sm hover:text-navy focus-visible:outline-2 focus-visible:outline-primary">
              How it works
            </a>
            <a href="#agreements" className="rounded-sm hover:text-navy focus-visible:outline-2 focus-visible:outline-primary">
              Agreements
            </a>
          </nav>
          <div className="ml-auto">
            <LandingNav />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
          <div aria-hidden className="absolute -right-40 -top-40 size-[32rem] rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                AI drafting for everyday business agreements
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-navy sm:text-5xl">
                Draft legal agreements in minutes, not days.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                Prelegal turns a short conversation into a complete NDA, cloud service agreement, DPA and more,
                built on Common Paper’s standard terms.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup/" className={buttonClass("primary", "px-5 py-3 text-base")}>
                  Start drafting
                  <ArrowRightIcon className="size-4" />
                </Link>
                <Link href="/login/" className={buttonClass("secondary", "px-5 py-3 text-base")}>
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Every document is a draft for review by a lawyer, not legal advice.
              </p>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-t border-slate-100 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="How it works" title="From first message to finished draft" />
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                      <step.icon />
                    </span>
                    <span className="text-sm font-semibold text-slate-500">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-navy">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="agreements" className="scroll-mt-20 bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Agreements"
              title={`${agreements.length} agreements, ready to draft`}
              description="Each one is built on Common Paper’s standard terms, free to use under CC BY 4.0."
            />
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agreements.map((spec) => (
                <li key={spec.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-navy">{spec.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{spec.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl space-y-10 px-4 sm:px-6">
            <div className="flex gap-4 rounded-xl border border-accent/60 bg-accent/10 p-6">
              <ShieldIcon className="size-6 shrink-0 text-navy" />
              <div>
                <h2 className="font-semibold text-navy">Drafts, not legal advice</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{DISCLAIMER}</p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-navy px-6 py-12 text-center sm:px-12">
              <div aria-hidden className="absolute -left-20 -top-20 size-64 rounded-full bg-secondary/40 blur-3xl" />
              <div aria-hidden className="absolute -bottom-24 -right-10 size-64 rounded-full bg-primary/30 blur-3xl" />
              <h2 className="relative text-3xl font-semibold tracking-tight text-white">
                Ready to draft your first agreement?
              </h2>
              <p className="relative mt-3 text-slate-200">Create a free account and have a draft in minutes.</p>
              <Link
                href="/signup/"
                className={buttonClass("primary", "relative mt-8 bg-accent px-5 py-3 text-base text-navy hover:bg-accent/90")}
              >
                Get started
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Brand />
          <p>
            Agreement templates by{" "}
            <a href="https://commonpaper.com" className="rounded-sm underline underline-offset-2 hover:text-navy focus-visible:outline-2 focus-visible:outline-primary">
              Common Paper
            </a>
            , licensed under{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              className="rounded-sm underline underline-offset-2 hover:text-navy focus-visible:outline-2 focus-visible:outline-primary"
            >
              CC BY 4.0
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-secondary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-navy">{title}</h2>
      {description && <p className="mt-3 text-slate-600">{description}</p>}
    </div>
  );
}

/** An illustration of the drafting screen: a chat turn and the fields it filled in. */
function ProductPreview() {
  const fields = [
    ["Parties", "Acme Corp & Beta LLC"],
    ["Purpose", "Evaluating a joint venture"],
    ["Governing law", "Delaware"],
    ["Confidentiality", "3 years"],
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-navy/10">
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
          <span className="size-2.5 rounded-full bg-slate-200" />
          <span className="size-2.5 rounded-full bg-slate-200" />
          <span className="size-2.5 rounded-full bg-slate-200" />
          <span className="ml-3 text-xs font-medium text-slate-500">Mutual Non-Disclosure Agreement</span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3 text-[13px]">
            <p className="ml-6 rounded-2xl rounded-br-sm bg-secondary px-3 py-2 text-white">
              We need an NDA with Beta LLC to explore a joint venture. Delaware law, 3 years.
            </p>
            <p className="mr-6 rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-800">
              Done! I’ve added Beta LLC, Delaware law and a 3-year term. Who signs for each company?
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 font-serif">
            <p className="text-center text-sm font-bold text-navy">Mutual NDA</p>
            <dl className="mt-3 space-y-2 text-xs">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt className="font-sans text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
                  <dd className="text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy shadow-lg sm:flex">
        <span className="flex size-5 items-center justify-center rounded-full bg-green-600 text-white">
          <CheckIcon className="size-3.5" />
        </span>
        Draft saved
      </div>
    </div>
  );
}
