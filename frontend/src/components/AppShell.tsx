"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/components/auth/useAuth";
import { Button } from "@/components/ui/fields";
import { confirmLeave } from "@/lib/unsavedChanges";

const NAV = [
  { href: "/draft/", label: "New document", short: "New" },
  { href: "/documents/", label: "My documents", short: "Documents" },
];

/**
 * Top bar and page frame for the signed-in part of the app. The frame is
 * exactly the viewport's height: the header stays in view, and pages scroll
 * their own panels (or `main`, for pages that don't).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  function handleSignOut() {
    if (!confirmLeave()) return;
    signOut();
    router.replace("/login/");
  }

  // Asks before a link discards unsaved changes on the current page.
  function guardLeave(event: MouseEvent) {
    if (!confirmLeave()) event.preventDefault();
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-8 sm:px-6">
          <Link
            href="/documents/"
            onClick={guardLeave}
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Brand />
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map((item) => {
              // Compared without the trailing slash, which the static export adds.
              const current = pathname.replace(/\/$/, "") === item.href.replace(/\/$/, "");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={guardLeave}
                  aria-current={current ? "page" : undefined}
                  className={
                    "rounded-md px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap transition " +
                    "focus-visible:outline-2 focus-visible:outline-primary " +
                    (current ? "bg-slate-100 text-navy" : "text-slate-600 hover:bg-slate-50 hover:text-navy")
                  }
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="hidden min-w-0 items-center gap-2 text-sm text-slate-600 md:flex" title={user?.email}>
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold uppercase text-white"
              >
                {user?.email.charAt(0)}
              </span>
              <span className="truncate">{user?.email}</span>
            </span>
            <Button variant="ghost" type="button" onClick={handleSignOut} className="px-3 py-1.5">
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
