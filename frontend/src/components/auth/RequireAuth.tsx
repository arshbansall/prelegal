"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/useAuth";

/**
 * Shows its children only to a signed-in user and sends everyone else to the
 * login page. The check runs in the browser because the app is a static export
 * (there is no server middleware).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login/");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div role="status" className="flex flex-1 items-center justify-center p-12">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  return children;
}
