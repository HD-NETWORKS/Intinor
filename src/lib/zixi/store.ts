import "server-only";

/**
 * Persistence for Zixi snapshot monitoring — the registry of known streams
 * (upserted on every push, so a never-seen stream ID registers itself) plus
 * the latest-snapshot object in Supabase Storage.
 *
 * Optional, like the rest of the Supabase-backed features: with no Supabase
 * env vars configured, reads return empty and writes are no-ops.
 */

import { expectOk, isConfigured, publicStorageUrl, rest, storageRequest } from "@/lib/supabase/rest";

const BUCKET = "zixi-snapshots";

export { isConfigured };

export interface ZixiStreamRow {
  stream_id: string;
  label: string;
  last_seen_at: string;
  created_at: string;
}

export interface ZixiStream {
  streamId: string;
  label: string;
  lastSeenAt: string;
  snapshotUrl: string | null;
}

function toStream(row: ZixiStreamRow): ZixiStream {
  return {
    streamId: row.stream_id,
    label: row.label,
    lastSeenAt: row.last_seen_at,
    snapshotUrl: publicStorageUrl(BUCKET, `${encodeURIComponent(row.stream_id)}.jpg`),
  };
}

/** All known streams, most-recently-seen first. */
export async function listStreams(): Promise<ZixiStream[]> {
  if (!isConfigured()) return [];
  const params = new URLSearchParams({ order: "last_seen_at.desc" });
  const res = await rest(`zixi_streams?${params}`);
  await expectOk(res, "zixi stream list");
  const rows = (await res.json()) as ZixiStreamRow[];
  return rows.map(toStream);
}

/** Registers a stream on its first push, and bumps last_seen_at (and label, if given) on every push since. */
export async function upsertStreamSeen(streamId: string, label: string): Promise<void> {
  if (!isConfigured()) return;
  const res = await rest("zixi_streams", {
    method: "POST",
    body: { stream_id: streamId, label, last_seen_at: new Date().toISOString() },
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await expectOk(res, "zixi stream upsert");
}

/** Overwrites the stream's latest snapshot in Storage. */
export async function uploadSnapshot(streamId: string, jpeg: ArrayBuffer): Promise<void> {
  if (!isConfigured()) return;
  const res = await storageRequest(`${BUCKET}/${encodeURIComponent(streamId)}.jpg`, {
    method: "POST",
    body: jpeg,
    contentType: "image/jpeg",
    upsert: true,
  });
  await expectOk(res, "zixi snapshot upload");
}
