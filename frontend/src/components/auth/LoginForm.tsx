"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/components/auth/useAuth";
import { Button, TextField } from "@/components/ui/fields";
import { ApiError } from "@/lib/api";

export function LoginForm() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Already signed in (or just signed in): go to the app.
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
      document.getElementById("email")?.focus();
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <Brand />
          </div>
          <h1 className="text-2xl font-semibold text-navy">Sign in</h1>
          <p className="text-sm text-slate-600">Draft common legal agreements in minutes.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            error={error}
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
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
          />
          <Button type="submit" disabled={submitting} aria-busy={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Placeholder sign-in: any email and password will work.
        </p>
      </div>
    </main>
  );
}
