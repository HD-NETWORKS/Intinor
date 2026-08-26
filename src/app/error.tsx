"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-segment error boundary. Renders inside the root layout (the header,
 * mode banner, and nav stay visible — only the page content area is
 * replaced), so a crash never hides which mode/unit you're on. Next's error
 * boundaries require unstable_retry rather than the classic reset() in this
 * version — see error.md in node_modules/next/dist/docs.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-4 rounded border border-signal-red-500/40 bg-panel p-6 text-center">
      <h1 className="text-lg font-semibold text-danger">Something went wrong</h1>
      <p className="text-sm text-muted">
        An unexpected error occurred while rendering this page. This is a dashboard bug, not
        necessarily a problem with the unit itself.
      </p>
      {error.digest && <p className="text-xs text-faint">Reference: {error.digest}</p>}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded border border-border-strong px-3 py-2 text-sm text-muted hover:bg-panel-hover hover:text-body"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
