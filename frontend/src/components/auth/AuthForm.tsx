"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/components/auth/useAuth";
import { Button, TextField } from "@/components/ui/fields";
import { CheckIcon } from "@/components/ui/icons";
import { Callout } from "@/components/ui/layout";
import { errorMessage } from "@/lib/api";
import { DISCLAIMER } from "@/lib/disclaimer";

type Mode = "login" | "signup";

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to pick up where you left off.",
    submit: "Sign in",
    submitting: "Signing in…",
    switchPrompt: "New to Prelegal?",
    switchLink: "Create an account",
    switchHref: "/signup/",
  },
  signup: {
    title: "Create your account",
    subtitle: "Draft your first agreement in a few minutes.",
    submit: "Create account",
    submitting: "Creating account…",
    switchPrompt: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/login/",
  },
} as const;

/** Where each form leads: returning users to their documents, new users straight to drafting. */
const HOME: Record<Mode, string> = { login: "/documents/", signup: "/draft/" };

const PASSWORD_MIN = 8;

/** The sign-in and sign-up page (`mode`), with a product panel beside the form on wide screens. */
export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const { status, signIn, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Already signed in (or just signed in): go to the app.
  useEffect(() => {
    if (status === "authenticated") router.replace(HOME[mode]);
  }, [status, router, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await (mode === "signup" ? signUp : signIn)(email, password);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
      document.getElementById(mode === "login" ? "password" : "email")?.focus();
    }
  }

  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <ProductPanel />

      <div className="flex flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="inline-block rounded-sm focus-visible:outline-2 focus-visible:outline-primary lg:hidden">
            <Brand />
          </Link>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-navy lg:mt-0">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{copy.subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <TextField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(value) => {
                setEmail(value);
                setError("");
              }}
            />
            <TextField
              id="password"
              label="Password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              hint={mode === "signup" ? `At least ${PASSWORD_MIN} characters.` : undefined}
              required
              minLength={mode === "signup" ? PASSWORD_MIN : undefined}
              maxLength={128}
              value={password}
              onChange={(value) => {
                setPassword(value);
                setError("");
              }}
            />
            {error && <Callout tone="error">{error}</Callout>}
            <Button type="submit" disabled={submitting} aria-busy={submitting} className="w-full py-2.5">
              {submitting ? copy.submitting : copy.submit}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {copy.switchPrompt}{" "}
            <Link
              href={copy.switchHref}
              className="font-semibold text-secondary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {copy.switchLink}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

const BENEFITS = [
  "Common Paper’s standard agreements, from NDAs to cloud service agreements",
  "An AI assistant fills in the details as you chat",
  "Save your drafts and pick up where you left off",
  "Download a clean, signature-ready PDF",
];

/** The brand panel shown beside the form on wide screens. */
function ProductPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-navy px-12 py-12 text-white lg:flex lg:flex-col">
      <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 -left-16 size-80 rounded-full bg-secondary/30 blur-3xl" />

      <Link href="/" className="relative self-start rounded-sm focus-visible:outline-2 focus-visible:outline-accent">
        <Brand tone="light" />
      </Link>

      <div className="relative my-auto max-w-md py-12">
        <p className="text-3xl font-semibold leading-tight tracking-tight">
          Legal agreements, drafted in a conversation.
        </p>
        <ul className="mt-8 space-y-4">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-3 text-sm text-slate-200">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-navy">
                <CheckIcon className="size-3.5" />
              </span>
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative max-w-md text-xs leading-relaxed text-slate-300">{DISCLAIMER}</p>
    </aside>
  );
}
