"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/components/auth/useAuth";
import { Button } from "@/components/ui/fields";

/**
 * Top bar and page frame for the signed-in part of the app. The frame is
 * exactly the viewport's height: the header stays in view, and pages scroll
 * their own panels (or `main`, for pages that don't).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  function handleSignOut() {
    signOut();
    router.replace("/login/");
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="rounded-sm focus-visible:outline-2 focus-visible:outline-primary">
            <Brand />
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm text-slate-600" title={user?.email}>
              {user?.email}
            </span>
            <Button variant="ghost" type="button" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
