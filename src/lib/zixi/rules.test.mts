import { evaluateZixiStaleness, ZIXI_STALE_AFTER_MS } from "./rules.ts";
import type { ZixiStream } from "./store.ts";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    fail++;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
  } else console.log(`ok   ${label}`);
}

const now = new Date("2026-09-10T00:00:00Z").getTime();

function stream(overrides: Partial<ZixiStream>): ZixiStream {
  return {
    streamId: "HDNK3",
    label: "HDNK3",
    lastSeenAt: new Date(now).toISOString(),
    snapshotUrl: null,
    ...overrides,
  };
}

{
  const fresh = stream({ lastSeenAt: new Date(now - 5_000).toISOString() });
  eq(evaluateZixiStaleness([fresh], now), [], "a recently-seen stream raises nothing");
}

{
  const stale = stream({
    streamId: "HDNK7",
    label: "Backup feed",
    lastSeenAt: new Date(now - (ZIXI_STALE_AFTER_MS + 1000)).toISOString(),
  });
  const detected = evaluateZixiStaleness([stale], now);
  eq(detected.length, 1, "a stream past the threshold raises exactly one alert");
  eq(detected[0]?.kind, "zixi_stream_down", "the alert kind is zixi_stream_down");
  eq(detected[0]?.subject, "HDNK7", "the alert subject is the stream id, not the label");
}

{
  const right_at_threshold = stream({ lastSeenAt: new Date(now - ZIXI_STALE_AFTER_MS).toISOString() });
  eq(
    evaluateZixiStaleness([right_at_threshold], now),
    [],
    "exactly at the threshold does not yet alert (strictly greater-than)",
  );
}

{
  const mixed = [
    stream({ streamId: "A", lastSeenAt: new Date(now - 1000).toISOString() }),
    stream({ streamId: "B", lastSeenAt: new Date(now - 60_000).toISOString() }),
    stream({ streamId: "C", lastSeenAt: new Date(now - 90_000).toISOString() }),
  ];
  const detected = evaluateZixiStaleness(mixed, now);
  eq(
    detected.map((d) => d.subject).sort(),
    ["B", "C"],
    "only the stale streams in a mixed list are flagged",
  );
}

if (fail > 0) {
  console.log(`${fail} test(s) failed`);
  process.exit(1);
} else {
  console.log("ALL PASS");
}
