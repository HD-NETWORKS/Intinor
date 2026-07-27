import "server-only";

/**
 * Supabase persistence for monitoring samples and alert episodes.
 *
 * Talks to PostgREST over plain HTTP rather than pulling in `@supabase/*` —
 * we need four queries, and a serverless cron function is a good place not to
 * add dependencies.
 *
 * Everything here is **optional**: with no Supabase env vars the module
 * reports `isConfigured() === false` and all calls become no-ops, so the app
 * (and the cron endpoint) still runs, just without history. That keeps the
 * dashboard usable before anyone has set up a database.
 *
 * The service-role key bypasses RLS and must never reach the browser — this
 * module is server-only, and the dashboard reads history through
 * /api/history rather than talking to Supabase directly.
 */

import type { AlertKind, AlertSeverity } from "./rules";

export interface MonitorSample {
  unit_id: string;
  ts: string;
  cpu_usage: number | null;
  memory_used_bytes: number | null;
  memory_total_bytes: number | null;
  battery_charge: number | null;
  storage_used_bytes: number | null;
  storage_size_bytes: number | null;
  firmware_running: string | null;
  firmware_default: string | null;
  encoders: unknown;
  inputs: unknown;
  interfaces: unknown;
}

export interface OpenAlertRow {
  id: number;
  unit_id: string;
  kind: AlertKind;
  subject: string;
  severity: AlertSeverity;
  message: string;
  opened_at: string;
  closed_at: string | null;
  notified_at: string | null;
}

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

export function isConfigured(): boolean {
  return config() !== null;
}

async function rest(
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

async function expectOk(res: Response, what: string): Promise<void> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase ${what} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

export async function insertSample(sample: MonitorSample): Promise<void> {
  if (!isConfigured()) return;
  const res = await rest("monitor_samples", {
    method: "POST",
    body: sample,
    prefer: "return=minimal",
  });
  await expectOk(res, "sample insert");
}

export async function fetchSamples(
  unitId: string,
  sinceIso: string,
  limit = 2000,
): Promise<MonitorSample[]> {
  if (!isConfigured()) return [];
  const params = new URLSearchParams({
    unit_id: `eq.${unitId}`,
    ts: `gte.${sinceIso}`,
    order: "ts.asc",
    limit: String(limit),
  });
  const res = await rest(`monitor_samples?${params}`);
  await expectOk(res, "sample query");
  return (await res.json()) as MonitorSample[];
}

// ---------------------------------------------------------------------------
// Alert episodes
// ---------------------------------------------------------------------------

export async function fetchOpenAlerts(unitId: string): Promise<OpenAlertRow[]> {
  if (!isConfigured()) return [];
  const params = new URLSearchParams({
    unit_id: `eq.${unitId}`,
    closed_at: "is.null",
    order: "opened_at.desc",
  });
  const res = await rest(`monitor_alerts?${params}`);
  await expectOk(res, "open-alert query");
  return (await res.json()) as OpenAlertRow[];
}

export async function fetchRecentAlerts(
  unitId: string,
  sinceIso: string,
  limit = 100,
): Promise<OpenAlertRow[]> {
  if (!isConfigured()) return [];
  const params = new URLSearchParams({
    unit_id: `eq.${unitId}`,
    opened_at: `gte.${sinceIso}`,
    order: "opened_at.desc",
    limit: String(limit),
  });
  const res = await rest(`monitor_alerts?${params}`);
  await expectOk(res, "recent-alert query");
  return (await res.json()) as OpenAlertRow[];
}

/**
 * Open a new alert episode. Returns the inserted row, or null when the
 * partial unique index rejected it because an episode is already open (the
 * race-safety backstop behind the in-code diff).
 */
export async function openAlert(row: {
  unit_id: string;
  kind: AlertKind;
  subject: string;
  severity: AlertSeverity;
  message: string;
}): Promise<OpenAlertRow | null> {
  if (!isConfigured()) return null;
  const res = await rest("monitor_alerts", {
    method: "POST",
    body: row,
    prefer: "return=representation",
  });
  if (res.status === 409) return null; // already open — not an error
  await expectOk(res, "alert insert");
  const rows = (await res.json()) as OpenAlertRow[];
  return rows[0] ?? null;
}

export async function closeAlert(id: number): Promise<void> {
  if (!isConfigured()) return;
  const res = await rest(`monitor_alerts?id=eq.${id}`, {
    method: "PATCH",
    body: { closed_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
  await expectOk(res, "alert close");
}

export async function markNotified(id: number): Promise<void> {
  if (!isConfigured()) return;
  const res = await rest(`monitor_alerts?id=eq.${id}`, {
    method: "PATCH",
    body: { notified_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
  await expectOk(res, "alert notify-mark");
}
