"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { PageSpinner } from "@/components/ui/layout";
import { fetchCurrentUser } from "@/lib/api";

/**
 * Shows its children only to a signed-in user and sends everyone else to the
 * sign-in page. The check runs in the browser because the app is a static
 * export (there is no server middleware).
 *
 * A stored token is checked with the backend once, before the page is shown:
 * the server forgets sessions when it restarts, and an invalid token is
 * cleared by `apiFetch`, which redirects here.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, token } = useAuth();
  const router = useRouter();
  const [checkedToken, setCheckedToken] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login/");
  }, [status, router]);

  useEffect(() => {
    if (!token || token === checkedToken) return;
    // On a 401 the session is cleared and the effect above redirects. Other
    // failures (e.g. the server is unreachable) show the page, whose own
    // requests then report the problem.
    fetchCurrentUser()
      .catch(() => {})
      .finally(() => setCheckedToken(token));
  }, [token, checkedToken]);

  return status === "authenticated" && checkedToken === token ? children : <PageSpinner />;
}
