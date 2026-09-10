/**
 * Staleness rule for Zixi feed monitoring — pure, no I/O, same shape and
 * open/resolve-episode idiom as @/lib/monitor/rules (see that file's design
 * note on why alerts key off a stateful diff rather than firing every poll).
 */

import type { DetectedAlert } from "@/lib/monitor/rules";
import type { ZixiStream } from "./store";

/** No push in this long counts as down. Matches the /zixi page's own badge, so "stale on screen" and "alerted by email" always agree. */
export const ZIXI_STALE_AFTER_MS = 30_000;

/** Sentinel `unit_id` for Zixi alert episodes in the shared monitor_alerts table — there's no Intinor unit involved. */
export const ZIXI_ALERT_UNIT_ID = "zixi";

export function evaluateZixiStaleness(
  streams: ZixiStream[],
  now: number = Date.now(),
): DetectedAlert[] {
  const alerts: DetectedAlert[] = [];
  for (const s of streams) {
    const ageMs = now - new Date(s.lastSeenAt).getTime();
    if (ageMs > ZIXI_STALE_AFTER_MS) {
      alerts.push({
        kind: "zixi_stream_down",
        subject: s.streamId,
        severity: "error",
        message: `${s.label} (${s.streamId}) has not pushed a snapshot in ${Math.round(
          ageMs / 1000,
        )}s — likely no signal at the source.`,
      });
    }
  }
  return alerts;
}
