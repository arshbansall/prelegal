"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/useAuth";
import { buttonClass } from "@/components/ui/fields";

/** The landing page's account links: sign in and sign up, or back to the app when signed in. */
export function LandingNav() {
  const { status } = useAuth();

  // Unknown until the browser has read the session; avoids a flash of the wrong links.
  if (status === "loading") return null;
  if (status === "authenticated") {
    return (
      <Link href="/documents/" className={buttonClass("primary")}>
        Go to my documents
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/login/" className={buttonClass("ghost")}>
        Sign in
      </Link>
      <Link href="/signup/" className={buttonClass("primary")}>
        Get started
      </Link>
    </div>
  );
}
