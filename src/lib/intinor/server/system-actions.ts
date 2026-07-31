import "server-only";

/**
 * Dedicated, reviewed path for system/actions/* — the endpoints guard.ts
 * blocks unconditionally at the generic proxy (reboot, power cycle, shutdown,
 * restart streams, firmware upgrade). Reaching the unit through here instead
 * requires clearing two independent gates:
 *
 *   1. Deploy-time: INTINOR_ALLOW_DESTRUCTIVE_ACTIONS=1. Off by default, and
 *      separate from INTINOR_ALLOW_WRITES — turning on routine settings
 *      writes must never quietly turn this on too.
 *   2. Per-request: the caller must echo the action's own name back
 *      (e.g. "REBOOT"), which the UI only ever gets from an explicit,
 *      separately-revealed confirmation control — never pre-filled.
 *
 * Mock mode always allows it (nothing real to protect) so the whole flow —
 * including the confirmation UI — can be exercised without touching a unit.
 */

import { destructiveActionsAllowed, isMockMode } from "./config";
import { resolveMock } from "../mock/resolve";
import { unitFetch } from "./unit-fetch";

export const SYSTEM_ACTIONS = [
  "reboot",
  "power_cycle",
  "shutdown",
  "restart_streams",
  "upgrade_firmware",
] as const;

export type SystemAction = (typeof SYSTEM_ACTIONS)[number];

export interface SystemActionResult {
  status: number;
  body: unknown;
}

function isSystemAction(action: string): action is SystemAction {
  return (SYSTEM_ACTIONS as readonly string[]).includes(action);
}

export async function performSystemAction(
  unitId: string,
  action: string,
  confirm: string,
  /** Only meaningful for `upgrade_firmware` — `?version=&source=` per docs/01-intinor-api-reference.md. */
  params?: { version?: string; source?: string },
): Promise<SystemActionResult> {
  if (!isSystemAction(action)) {
    return {
      status: 400,
      body: {
        title: "Unknown action",
        status: 400,
        message: `'${action}' is not a recognized system action.`,
      },
    };
  }

  if (!isMockMode() && !destructiveActionsAllowed()) {
    return {
      status: 403,
      body: {
        title: "Destructive actions disabled",
        status: 403,
        message:
          "Set INTINOR_ALLOW_DESTRUCTIVE_ACTIONS=1 to enable this action. " +
          "It is intentionally off by default, separately from routine writes.",
      },
    };
  }

  const expected = action.toUpperCase();
  if (confirm !== expected) {
    return {
      status: 400,
      body: {
        title: "Confirmation mismatch",
        status: 400,
        message: `Type '${expected}' exactly to confirm.`,
      },
    };
  }

  const search =
    action === "upgrade_firmware" && (params?.version || params?.source)
      ? "?" +
        new URLSearchParams({
          ...(params?.version ? { version: params.version } : {}),
          ...(params?.source ? { source: params.source } : {}),
        }).toString()
      : "";
  const path = `system/actions/${action}`;

  if (isMockMode()) {
    const mock = resolveMock("POST", `${path}${search}`);
    return { status: mock.status, body: mock.body };
  }

  try {
    const res = await unitFetch(unitId, path, { method: "POST", search });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch (err) {
    return {
      status: 502,
      body: {
        title: "Unit unreachable",
        status: 502,
        message: err instanceof Error ? err.message : "Failed to reach the unit",
      },
    };
  }
}
