/**
 * Safety guard for the /api/unit proxy.
 *
 * Two independent gates, checked in order:
 *
 * 1. Destructive/disruptive endpoints are ALWAYS blocked at the proxy,
 *    regardless of any env flag. Enabling one of these later requires adding
 *    a dedicated, reviewed API route with its own type-to-confirm flow —
 *    the generic proxy will never forward them.
 *
 * 2. All other writes (PUT/POST/DELETE) are blocked unless
 *    INTINOR_ALLOW_WRITES=1 (or in mock mode, where no real unit is touched).
 */

import { isMockMode, writesAllowed } from "./config";

const READ_METHODS = new Set(["GET", "HEAD"]);

/** Matched against the unit-relative path, e.g. "system/actions/reboot". */
const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /^system\/actions\/(reboot|power_cycle|shutdown|upgrade_firmware|restart_streams)$/,
  /^system\/config$/, // PUT = restore from backup (reboots the unit)
  /^storage\/actions\/(format|rebuild_raid)$/,
  /^media_bank\/actions\/clear$/,
];

export type GuardResult =
  | { allowed: true }
  | { allowed: false; status: number; reason: string };

export function checkRequest(method: string, unitPath: string): GuardResult {
  const m = method.toUpperCase();

  if (READ_METHODS.has(m)) {
    return { allowed: true };
  }

  if (DESTRUCTIVE_PATTERNS.some((p) => p.test(unitPath))) {
    return {
      allowed: false,
      status: 403,
      reason:
        `'${m} /${unitPath}' is a destructive/disruptive operation and is ` +
        `permanently blocked by this proxy. It can only be exposed through a ` +
        `dedicated route with an explicit confirmation step.`,
    };
  }

  if (!writesAllowed() && !isMockMode()) {
    return {
      allowed: false,
      status: 403,
      reason:
        `Write operations against the live unit are disabled ` +
        `(read-only development mode). Set MOCK=1 to develop against mock ` +
        `data, or INTINOR_ALLOW_WRITES=1 once this feature has been reviewed.`,
    };
  }

  return { allowed: true };
}
