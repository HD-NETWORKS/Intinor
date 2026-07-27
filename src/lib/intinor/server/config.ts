/**
 * Server-only configuration for talking to the Intinor unit(s).
 * Nothing in this module (or anything it feeds) may reach client-side JS.
 *
 * Multi-unit: a single "primary" unit is configured with the plain
 * INTINOR_UNIT_* variables (unchanged from earlier phases — existing
 * deployments need no changes). Additional units — reached at the same
 * `https://iss.intinor.se/api/v1/units/{id}/` shape with a different id, or
 * on a different host entirely — are added via INTINOR_UNITS, a JSON array.
 * Nothing above this module ever hardcodes a unit id or path: routes take a
 * unitId and resolve it here, so pointing at a second unit is a config
 * change, not a code change.
 */

export interface UnitConfig {
  /** Unit serial, e.g. "D01393". Also the registry key. */
  id: string;
  /** Host or IP of the unit (or iss.intinor.se for central management) */
  host: string;
  username: string;
  password: string;
  /** Base URL for the unit's REST API */
  baseUrl: string;
  label?: string;
}

interface RawUnit {
  id: string;
  host: string;
  username: string;
  password: string;
  label?: string;
}

export function isMockMode(): boolean {
  return process.env.MOCK === "1";
}

/**
 * Global write switch. Defaults to OFF: during development the real unit is
 * strictly read-only. Set INTINOR_ALLOW_WRITES=1 only after a specific write
 * feature has been reviewed and approved.
 */
export function writesAllowed(): boolean {
  return process.env.INTINOR_ALLOW_WRITES === "1";
}

/**
 * Separate, higher-stakes switch for system/actions/* (reboot, power cycle,
 * shutdown, restart streams, firmware upgrade). Turning on routine
 * settings-writes must never silently turn these on too — they get their own
 * flag, checked in addition to (not instead of) the per-request type-to-
 * confirm step in the UI.
 */
export function destructiveActionsAllowed(): boolean {
  return process.env.INTINOR_ALLOW_DESTRUCTIVE_ACTIONS === "1";
}

const MOCK_UNIT_ID = "D01393";

function primaryUnitFromEnv(): RawUnit | null {
  const host = process.env.INTINOR_UNIT_HOST;
  const id = process.env.INTINOR_UNIT_ID;
  const username = process.env.INTINOR_USERNAME;
  const password = process.env.INTINOR_PASSWORD;
  if (!host || !id || !username || !password) return null;
  return { id, host, username, password };
}

/**
 * Extra units beyond the primary one, as a JSON array:
 *   INTINOR_UNITS=[{"id":"D02237","host":"iss.intinor.se","username":"...","password":"..."}]
 * Malformed or partial entries are dropped rather than thrown on — a typo in
 * a second unit's config shouldn't take down the first.
 */
function extraUnitsFromEnv(): RawUnit[] {
  const raw = process.env.INTINOR_UNITS;
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (u): u is RawUnit =>
      Boolean(u) &&
      typeof u === "object" &&
      typeof (u as RawUnit).id === "string" &&
      typeof (u as RawUnit).host === "string" &&
      typeof (u as RawUnit).username === "string" &&
      typeof (u as RawUnit).password === "string",
  );
}

function allRawUnits(): RawUnit[] {
  const primary = primaryUnitFromEnv();
  const extra = extraUnitsFromEnv();
  return primary ? [primary, ...extra] : extra;
}

/** All configured unit ids (mock mode: a single synthetic id + any extras). */
export function listUnitIds(): string[] {
  if (isMockMode()) {
    const mockId = process.env.INTINOR_UNIT_ID || MOCK_UNIT_ID;
    return [mockId, ...extraUnitsFromEnv().map((u) => u.id)];
  }
  return allRawUnits().map((u) => u.id);
}

/** The unit routes fall back to when no unitId is given in the URL. */
export function defaultUnitId(): string {
  if (isMockMode()) {
    return process.env.INTINOR_UNIT_ID || MOCK_UNIT_ID;
  }
  const [first] = allRawUnits();
  if (!first) {
    throw new Error(
      "No Intinor unit configured. Set INTINOR_UNIT_HOST/INTINOR_UNIT_ID/" +
        "INTINOR_USERNAME/INTINOR_PASSWORD in .env.local, or set MOCK=1 to " +
        "work with mock data.",
    );
  }
  return first.id;
}

export function getUnitConfig(unitId?: string): UnitConfig {
  if (isMockMode()) {
    const id = unitId ?? defaultUnitId();
    return { id, host: "mock", username: "mock", password: "mock", baseUrl: `mock://units/${id}` };
  }

  const units = allRawUnits();
  const targetId = unitId ?? units[0]?.id;
  const found = units.find((u) => u.id === targetId);
  if (!found) {
    const known = units.map((u) => u.id).join(", ") || "(none)";
    throw new Error(
      `Unit '${unitId ?? "(default)"}' is not configured. Configured units: ${known}. ` +
        `Set them in .env.local, or set MOCK=1 to work with mock data.`,
    );
  }

  return {
    ...found,
    baseUrl: `https://${found.host}/api/v1/units/${found.id}`,
  };
}

/**
 * A unit accessed by IP typically presents a self-signed certificate.
 * INTINOR_ALLOW_SELF_SIGNED=1 disables TLS verification for this server
 * process — acceptable for a LAN-only proxy backend, never the default.
 */
if (process.env.INTINOR_ALLOW_SELF_SIGNED === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
