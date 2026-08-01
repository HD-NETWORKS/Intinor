import type { NextConfig } from "next";

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
