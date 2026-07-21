/**
 * Server-only configuration for talking to the Intinor unit.
 * Nothing in this module (or anything it feeds) may reach client-side JS.
 */

export interface UnitConfig {
  /** Host or IP of the unit (or iss.intinor.se for central management) */
  host: string;
  /** Unit serial, e.g. "D01393" */
  unitId: string;
  username: string;
  password: string;
  /** Base URL for the unit's REST API */
  baseUrl: string;
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

export function getUnitConfig(): UnitConfig {
  const host = process.env.INTINOR_UNIT_HOST;
  const unitId = process.env.INTINOR_UNIT_ID;
  const username = process.env.INTINOR_USERNAME;
  const password = process.env.INTINOR_PASSWORD;

  const missing = [
    !host && "INTINOR_UNIT_HOST",
    !unitId && "INTINOR_UNIT_ID",
    !username && "INTINOR_USERNAME",
    !password && "INTINOR_PASSWORD",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Intinor unit not configured (missing ${missing.join(", ")}). ` +
        `Set them in .env.local, or set MOCK=1 to work with mock data.`,
    );
  }

  return {
    host: host!,
    unitId: unitId!,
    username: username!,
    password: password!,
    baseUrl: `https://${host}/api/v1/units/${unitId}`,
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
