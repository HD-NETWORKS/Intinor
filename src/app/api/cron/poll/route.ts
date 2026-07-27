/**
 * Monitoring poll — the scheduled job behind alerting and history.
 *
 * Each invocation:
 *   1. collects a read-only snapshot of the unit (GETs only — never writes),
 *   2. stores it as a time-series row,
 *   3. evaluates the alert rules against it plus the previous sample,
 *   4. opens/closes alert episodes and notifies only on transitions.
 *
 * Cadence-independent by design: alerts key off state transitions rather than
 * "how long since the last run", so it behaves correctly whether it is
 * triggered every minute by an external scheduler or once a day by Vercel's
 * Hobby-plan cron. See README §Phase 4 for why that matters.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Any other
 * caller must present the same secret (header or `?secret=`). If CRON_SECRET
 * is unset the route refuses to run rather than sitting open — an unauth'd
 * endpoint that hammers the unit and sends messages is not a good default.
 */

import { NextRequest, NextResponse } from "next/server";
import { collectSnapshot, rowToSnapshot, snapshotToRow } from "@/lib/monitor/collect";
import { diffAlerts, evaluateRules, alertKey } from "@/lib/monitor/rules";
import { configuredChannels, deliver } from "@/lib/monitor/notify";
import {
  closeAlert,
  fetchOpenAlerts,
  fetchSamples,
  insertSample,
  isConfigured as storeConfigured,
  markNotified,
  openAlert,
} from "@/lib/monitor/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unitId(): string {
  return process.env.INTINOR_UNIT_ID ?? "D01393";
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      {
        error: process.env.CRON_SECRET
          ? "Unauthorized"
          : "CRON_SECRET is not set — refusing to run.",
      },
      { status: 401 },
    );
  }

  const id = unitId();
  const started = Date.now();

  // 1. Collect (read-only).
  const snapshot = await collectSnapshot(id);

  // 2. Previous sample, for transition-scoped rules.
  let previous = null;
  if (storeConfigured()) {
    try {
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const recent = await fetchSamples(id, since, 1000);
      const last = recent.at(-1);
      if (last) previous = rowToSnapshot(last);
    } catch {
      // History is best-effort; a read failure must not stop alerting.
    }
  }

  // 3. Store the sample.
  let stored = false;
  let storeError: string | null = null;
  if (storeConfigured()) {
    try {
      await insertSample(snapshotToRow(snapshot));
      stored = true;
    } catch (err) {
      storeError = err instanceof Error ? err.message : "sample insert failed";
    }
  }

  // 4. Evaluate + diff against open episodes.
  const open = storeConfigured() ? await fetchOpenAlerts(id).catch(() => []) : [];
  const openKeys = new Set(open.map((o) => alertKey(o.kind, o.subject)));
  const detected = evaluateRules(snapshot, { previous, openKeys });
  const { opened, resolved, ongoing } = diffAlerts(detected, open);

  const delivered: unknown[] = [];

  // New conditions → open an episode, then notify.
  for (const alert of opened) {
    const row = await openAlert({
      unit_id: id,
      kind: alert.kind,
      subject: alert.subject,
      severity: alert.severity,
      message: alert.message,
    }).catch(() => null);

    const results = await deliver({
      unitId: id,
      severity: alert.severity,
      recovery: false,
      title: `${humanKind(alert.kind)} — ${alert.subject}`,
      body: alert.message,
    });
    delivered.push({ kind: alert.kind, subject: alert.subject, results });
    if (row) await markNotified(row.id).catch(() => {});
  }

  // Cleared conditions → close the episode and send a recovery note.
  for (const row of resolved) {
    await closeAlert(row.id).catch(() => {});
    const results = await deliver({
      unitId: id,
      severity: row.severity,
      recovery: true,
      title: `Resolved: ${humanKind(row.kind)} — ${row.subject}`,
      body: `Condition cleared. Originally: ${row.message}`,
    });
    delivered.push({ kind: row.kind, subject: row.subject, recovery: true, results });
  }

  return NextResponse.json({
    ok: true,
    unitId: id,
    ts: snapshot.ts,
    durationMs: Date.now() - started,
    history: {
      configured: storeConfigured(),
      stored,
      ...(storeError ? { error: storeError } : {}),
    },
    alerts: {
      channels: configuredChannels(),
      detected: detected.length,
      opened: opened.length,
      resolved: resolved.length,
      // `ongoing` is the anti-spam path: still broken, already told you.
      ongoing: ongoing.length,
      delivered,
    },
  });
}

function humanKind(kind: string): string {
  switch (kind) {
    case "stream_down":
      return "Stream down";
    case "firmware_update":
      return "Firmware update available";
    case "storage_full":
      return "Storage almost full";
    case "link_loss":
      return "Link loss";
    default:
      return kind;
  }
}
