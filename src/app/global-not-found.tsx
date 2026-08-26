import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Not found — Intinor Dashboard",
};

/**
 * Catches genuinely unmatched URLs (typos, stale bookmarks) — see the
 * experimental.globalNotFound flag in next.config.ts and error.md in
 * node_modules/next/dist/docs for why the plain app/not-found.tsx
 * convention alone doesn't do this in this Next version.
 *
 * This bypasses the root layout entirely (no AppShell, no header/nav), so
 * it imports globals.css directly and relies on the prefers-color-scheme
 * fallback in there rather than the app's stored light/dark toggle — the
 * localStorage-based theme choice lives in a script the root layout runs,
 * which this page never reaches.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full items-center justify-center bg-page p-6 text-fg">
        <div className="max-w-sm space-y-4 rounded border border-border-default bg-panel p-6 text-center">
          <h1 className="text-lg font-semibold text-fg">Page not found</h1>
          <p className="text-sm text-muted">
            The page you&apos;re looking for doesn&apos;t exist, or the link is out of date.
          </p>
          <Link
            href="/"
            className="inline-block rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
          >
            Back to dashboard
          </Link>
        </div>
      </body>
    </html>
  );
}
