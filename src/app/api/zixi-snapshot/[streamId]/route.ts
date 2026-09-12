/**
 * Inbound push endpoint for the Zixi snapshot install-script agent running on
 * each Zixi-sending server. Not a browser route — no dashboard session, no
 * CSRF concerns — so it authenticates with its own shared secret instead
 * (same posture as /api/cron/poll's CRON_SECRET), and is carved out of the
 * dashboard's session gate in proxy.ts.
 *
 * One call = one snapshot: registers the stream (first call) or bumps its
 * last_seen_at (every call after), and overwrites its latest image in
 * Storage. The agent skips calling this at all when it can't grab a frame
 * (e.g. no local RTMP signal) — that's what lets the dashboard's staleness
 * check mean something.
 */

import { NextRequest, NextResponse } from "next/server";
import { isConfigured, uploadSnapshot, upsertStreamSeen } from "@/lib/zixi/store";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // generous ceiling for a single low-quality JPEG frame
const STREAM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function authorized(req: NextRequest): boolean {
  const secret = process.env.ZIXI_SNAPSHOT_TOKEN;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  if (!authorized(req)) {
    return NextResponse.json(
      {
        error: process.env.ZIXI_SNAPSHOT_TOKEN
          ? "Unauthorized"
          : "ZIXI_SNAPSHOT_TOKEN is not set — refusing to accept snapshots.",
      },
      { status: 401 },
    );
  }

  const { streamId } = await params;
  if (!STREAM_ID_RE.test(streamId)) {
    return NextResponse.json(
      { error: "Stream ID must be 1-64 letters, digits, '-' or '_'." },
      { status: 400 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/jpeg")) {
    return NextResponse.json({ error: "Body must be image/jpeg." }, { status: 415 });
  }

  const body = await req.arrayBuffer();
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "Empty body." }, { status: 400 });
  }
  if (body.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Snapshot too large." }, { status: 413 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const label = req.headers.get("x-channel-label")?.trim() || streamId;

  try {
    await Promise.all([uploadSnapshot(streamId, body), upsertStreamSeen(streamId, label)]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Snapshot store failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
