import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    // Lets app/global-not-found.tsx catch genuinely unmatched URLs (typos,
    // stale bookmarks) — the plain app/not-found.tsx convention only fires
    // from an explicit notFound() call within a matched route in this
    // Next version, not automatically for unmatched paths.
    globalNotFound: true,
  },
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (env vars, in this app's
// case — no KV/R2/D1) the same way they're available once deployed, so
// local dev matches production rather than silently reading nothing. A
// no-op outside of Cloudflare tooling; see README §Phase 26.
initOpenNextCloudflareForDev();
