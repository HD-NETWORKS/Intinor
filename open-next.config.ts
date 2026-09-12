import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default config: no KV/R2/D1 bindings needed — this app only reads plain
// env vars (Supabase over PostgREST, not a binding) and has no ISR/ODB cache
// to speak of (every page here is either dynamic per-request or a small
// static shell). See README §Phase 26 for the why behind this migration.
export default defineCloudflareConfig();
