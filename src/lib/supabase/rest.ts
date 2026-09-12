import "server-only";

/**
 * Thin PostgREST client shared by every Supabase-backed feature (monitor
 * history/alerts, Zixi snapshot streams). Talks to PostgREST over plain HTTP
 * rather than pulling in `@supabase/*` — a handful of queries don't justify
 * the dependency, especially from serverless functions.
 *
 * Every caller must treat this as optional: `isConfigured()` says whether the
 * env vars are set, and callers should no-op (not throw) when they aren't, so
 * the dashboard stays usable before Supabase is set up.
 *
 * The service-role key bypasses RLS and must never reach the browser — this
 * module is server-only.
 */

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

export function isConfigured(): boolean {
  return config() !== null;
}

/** The bare project URL (e.g. `https://xyz.supabase.co`), or null if unconfigured. */
export function projectUrl(): string | null {
  return config()?.url ?? null;
}

export async function rest(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase is not configured");
  return fetch(`${cfg.url}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
}

/** Supabase Storage's object API — separate base path from PostgREST, same auth. */
export async function storageRequest(
  path: string,
  init: { method?: string; body?: BodyInit; contentType?: string; upsert?: boolean } = {},
): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase is not configured");
  return fetch(`${cfg.url}/storage/v1/object/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      ...(init.contentType ? { "Content-Type": init.contentType } : {}),
      ...(init.upsert ? { "x-upsert": "true" } : {}),
    },
    body: init.body,
    cache: "no-store",
  });
}

/** Public URL for an object in a public bucket — no auth needed to fetch it. */
export function publicStorageUrl(bucket: string, path: string): string | null {
  const url = projectUrl();
  if (!url) return null;
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

export async function expectOk(res: Response, what: string): Promise<void> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase ${what} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}
