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
  // Deliberately conservative: these carry essentially no regression risk
  // (none of them touch what the app actually loads or runs) and close off
  // a few standard header-level attack classes. A full script-src/style-src
  // CSP is NOT included here — this app relies on Next's own inline
  // hydration scripts, an inline theme-init script, and hls.js, and getting
  // a restrictive CSP right for all of that needs testing against a real
  // deployed build that wasn't available when this was added. Revisit with
  // a nonce-based CSP if that ever becomes feasible to verify properly.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking: this dashboard controls real broadcast hardware,
          // so being framed by another site is a real risk, not a style
          // nit. Both headers for broad browser support (frame-ancestors is
          // the modern CSP replacement for X-Frame-Options).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Stops a browser from "helpfully" re-interpreting a response's
          // content type (e.g. treating a JSON API response as executable
          // script because of sniffed content).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak this dashboard's internal URLs (resource paths,
          // stream IDs, etc.) to a third-party site via the Referer header
          // when a link here is followed off-site.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // This app never needs camera/microphone/geolocation — deny them
          // outright rather than leaving the default (which inherits
          // whatever the browser allows).
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Always served over HTTPS in every real deployment (Vercel,
          // Cloudflare) — tell browsers to enforce that for two years,
          // including subdomains, rather than trusting every individual
          // request to arrive over TLS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (env vars, in this app's
// case — no KV/R2/D1) the same way they're available once deployed, so
// local dev matches production rather than silently reading nothing. A
// no-op outside of Cloudflare tooling; see README §Phase 26.
initOpenNextCloudflareForDev();
