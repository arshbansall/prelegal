import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { buttonClass } from "@/components/ui/fields";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Brand />
      <p className="mt-10 text-sm font-semibold text-secondary">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy">Page not found</h1>
      <p className="mt-3 max-w-sm text-sm text-slate-600">The page you’re looking for doesn’t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className={buttonClass("secondary")}>
          Home
        </Link>
        <Link href="/documents/" className={buttonClass("primary")}>
          My documents
        </Link>
      </div>
    </main>
  );
}
