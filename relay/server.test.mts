// Integration test for the relay: spawns the real server as a child process
// (it has real side effects — a listening socket, an unref'd GC interval —
// that aren't worth faking) and exercises it over real HTTP.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 8931;
const TOKEN = "test-relay-token";
const BASE = `http://127.0.0.1:${PORT}`;

let fail = 0;
function ok(cond: boolean, label: string) {
  if (!cond) {
    fail++;
    console.log(`FAIL ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

async function main() {
  const child = spawn(process.execPath, [new URL("./server.mjs", import.meta.url).pathname], {
    env: { ...process.env, RELAY_PORT: String(PORT), RELAY_INGEST_TOKEN: TOKEN },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => console.error(`[relay stderr] ${d}`));

  try {
    // Give it a moment to bind.
    await delay(400);

    // Unauthenticated ingest is rejected.
    const noAuth = await fetch(`${BASE}/ingest/HDNK3/index.m3u8`, { method: "PUT", body: "#EXTM3U" });
    ok(noAuth.status === 401, "PUT without a token is rejected with 401");

    // Authenticated ingest of a playlist + a segment.
    const putPlaylist = await fetch(`${BASE}/ingest/HDNK3/index.m3u8`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: "#EXTM3U\n#EXT-X-VERSION:3\n",
    });
    ok(putPlaylist.status === 200, "authenticated PUT of the playlist succeeds");

    const putSegment = await fetch(`${BASE}/ingest/HDNK3/seg_0.ts`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: Buffer.from([0x47, 0x40, 0x00, 0x10]),
    });
    ok(putSegment.status === 200, "authenticated PUT of a segment succeeds");

    // Playback is public and returns the right content types.
    const getPlaylist = await fetch(`${BASE}/hls/HDNK3/index.m3u8`);
    ok(getPlaylist.status === 200, "GET the playlist back with no auth needed");
    ok(
      getPlaylist.headers.get("content-type") === "application/vnd.apple.mpegurl",
      "playlist content-type is application/vnd.apple.mpegurl",
    );
    const playlistBody = await getPlaylist.text();
    ok(playlistBody.startsWith("#EXTM3U"), "playlist body round-trips");

    const getSegment = await fetch(`${BASE}/hls/HDNK3/seg_0.ts`);
    ok(getSegment.headers.get("content-type") === "video/mp2t", "segment content-type is video/mp2t");

    const getMissing = await fetch(`${BASE}/hls/HDNK3/nope.ts`);
    ok(getMissing.status === 404, "GET of a file that was never ingested 404s");

    // Deleting a segment removes it (ffmpeg's -hls_flags delete_segments
    // issues real DELETEs against method-PUT HTTP output).
    const del = await fetch(`${BASE}/ingest/HDNK3/seg_0.ts`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    ok(del.status === 200, "authenticated DELETE of a segment succeeds");
    const getDeleted = await fetch(`${BASE}/hls/HDNK3/seg_0.ts`);
    ok(getDeleted.status === 404, "the deleted segment is gone");

    // Viewer signaling: nothing wanted until a heartbeat arrives.
    const wantedBefore = (await (await fetch(`${BASE}/viewers/HDNK3/wanted`)).json()) as { wanted: boolean };
    ok(wantedBefore.wanted === false, "nothing wanted before any heartbeat");

    const beat = await fetch(`${BASE}/viewers/HDNK3/heartbeat`, { method: "POST" });
    ok(beat.status === 200, "an unauthenticated heartbeat is accepted");

    const wantedAfter = (await (await fetch(`${BASE}/viewers/HDNK3/wanted`)).json()) as { wanted: boolean };
    ok(wantedAfter.wanted === true, "wanted is true right after a heartbeat");

    // A stream that's never been touched at all is not wanted.
    const wantedOther = (await (await fetch(`${BASE}/viewers/NEVERSEEN/wanted`)).json()) as { wanted: boolean };
    ok(wantedOther.wanted === false, "an unknown stream is never wanted");

    // CORS: preflight and the actual headers on a real response.
    const preflight = await fetch(`${BASE}/viewers/HDNK3/heartbeat`, { method: "OPTIONS" });
    ok(preflight.status === 204, "OPTIONS preflight returns 204");
    ok(
      preflight.headers.get("access-control-allow-origin") === "*",
      "CORS is open on the preflight response",
    );
    ok(
      getPlaylist.headers.get("access-control-allow-origin") === "*",
      "CORS is open on a real playback response",
    );

    const health = await fetch(`${BASE}/healthz`);
    ok(health.status === 200, "healthz responds");
  } finally {
    child.kill();
  }

  if (fail > 0) {
    console.log(`${fail} test(s) failed`);
    process.exit(1);
  } else {
    console.log("ALL PASS");
  }
}

main();
