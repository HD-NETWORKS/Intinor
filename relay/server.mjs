/**
 * Low-bitrate live preview relay — see README §Phase 24 for the why.
 *
 * A small, dependency-free HTTP server meant to run on the one always-on
 * Windows box that already runs cloudflared for D01393, given its own
 * public hostname on that same tunnel. It has two jobs:
 *
 *   1. Ingest: accept the HLS playlist + segments a Zixi-sending server's
 *      agent pushes via ffmpeg's own `-method PUT` HTTP output, and serve
 *      them back out for playback. Everything lives in memory, keyed by
 *      streamId — it's live video, a restart just means players reconnect.
 *   2. Viewer signaling: let the dashboard's player announce "someone has
 *      this tile open" (a heartbeat) and let the agent cheaply ask "is
 *      anyone watching?" so it only pays for a live encode while it matters.
 *
 * Usage: `RELAY_INGEST_TOKEN=... node relay/server.mjs` (RELAY_PORT
 * optional, default 8080). Refuses to start without a token — an ingest
 * endpoint that accepts unauthenticated video from the internet is not a
 * good default, the same call already made for CRON_SECRET and
 * ZIXI_SNAPSHOT_TOKEN elsewhere in this project.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.RELAY_PORT) || 8080;
const TOKEN = process.env.RELAY_INGEST_TOKEN;

if (!TOKEN) {
  console.error("RELAY_INGEST_TOKEN is not set — refusing to start.");
  process.exit(1);
}

// A viewer is still "watching" for this long after their last heartbeat —
// a few missed beats' grace (heartbeats are sent every ~5s) so a
// momentarily backgrounded tab doesn't flap the agent's encode on and off.
const WANTED_GRACE_MS = 15_000;

// Streams with no ingest and no heartbeat for this long are dropped from
// memory entirely — just housekeeping against a typo'd or abandoned
// streamId accumulating forever, not a correctness requirement.
const STALE_GC_MS = 10 * 60 * 1000;
const GC_INTERVAL_MS = 60_000;

const CONTENT_TYPES = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

/** @type {Map<string, { files: Map<string, {body: Buffer, contentType: string, updatedAt: number}>, lastHeartbeatAt: number|null, lastIngestAt: number|null }>} */
const streams = new Map();

function getStream(streamId) {
  let s = streams.get(streamId);
  if (!s) {
    s = { files: new Map(), lastHeartbeatAt: null, lastIngestAt: null };
    streams.set(streamId, s);
  }
  return s;
}

function contentTypeFor(filename) {
  const dot = filename.lastIndexOf(".");
  const ext = dot === -1 ? "" : filename.slice(dot);
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

function authorized(req) {
  return req.headers["authorization"] === `Bearer ${TOKEN}`;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function send(res, status, body, contentType = "application/json") {
  const buf = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": contentType });
  res.end(buf);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const MAX_SEGMENT_BYTES = 2 * 1024 * 1024;

const server = createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://relay.local");
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    // --- Ingest: PUT/DELETE /ingest/{streamId}/{file} ------------------
    if (parts[0] === "ingest" && parts.length === 3) {
      const [, streamId, file] = parts;
      if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });

      const stream = getStream(streamId);
      if (req.method === "PUT") {
        const body = await readBody(req, MAX_SEGMENT_BYTES);
        stream.files.set(file, { body, contentType: contentTypeFor(file), updatedAt: Date.now() });
        stream.lastIngestAt = Date.now();
        return send(res, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        stream.files.delete(file);
        stream.lastIngestAt = Date.now();
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { error: "Method not allowed" });
    }

    // --- Playback: GET /hls/{streamId}/{file} --------------------------
    if (parts[0] === "hls" && parts.length === 3 && req.method === "GET") {
      const [, streamId, file] = parts;
      const stream = streams.get(streamId);
      const entry = stream?.files.get(file);
      if (!entry) return send(res, 404, { error: "Not found" });
      return send(res, 200, entry.body, entry.contentType);
    }

    // --- Viewer signaling: /viewers/{streamId}/heartbeat | wanted ------
    if (parts[0] === "viewers" && parts.length === 3) {
      const [, streamId, action] = parts;
      const stream = getStream(streamId);
      if (action === "heartbeat" && req.method === "POST") {
        stream.lastHeartbeatAt = Date.now();
        return send(res, 200, { ok: true });
      }
      if (action === "wanted" && req.method === "GET") {
        const wanted = !!stream.lastHeartbeatAt && Date.now() - stream.lastHeartbeatAt <= WANTED_GRACE_MS;
        return send(res, 200, { wanted });
      }
    }

    if (parts[0] === "healthz" && req.method === "GET") {
      return send(res, 200, { ok: true, streams: streams.size });
    }

    return send(res, 404, { error: "Not found" });
  } catch (err) {
    return send(res, 400, { error: err instanceof Error ? err.message : "Bad request" });
  }
});

setInterval(() => {
  const cutoff = Date.now() - STALE_GC_MS;
  for (const [streamId, s] of streams) {
    const lastActivity = Math.max(s.lastIngestAt ?? 0, s.lastHeartbeatAt ?? 0);
    if (lastActivity < cutoff) streams.delete(streamId);
  }
}, GC_INTERVAL_MS).unref();

server.listen(PORT, () => {
  console.log(`Zixi preview relay listening on :${PORT}`);
});
