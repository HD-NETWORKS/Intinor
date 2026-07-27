/**
 * Server-only configuration for the dashboard's own login gate.
 *
 * Deliberately separate from the Intinor unit's credentials — the unit's
 * username/session id are used only server-side to talk to the unit's API
 * and never reach the browser, so they can't double as a login for the
 * dashboard itself. Without this, anyone who finds the Vercel URL gets the
 * full dashboard (mock or live). One shared operator account, no user table:
 * this fits a small ops team, not a multi-tenant product.
 */

export function authDisabled(): boolean {
  return process.env.DASHBOARD_AUTH_DISABLED === "1";
}

export interface AuthCredentials {
  username: string;
  password: string;
  secret: string;
}

export function authCredentials(): AuthCredentials | null {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!username || !password || !secret) return null;
  return { username, password, secret };
}

export function isAuthConfigured(): boolean {
  return authCredentials() !== null;
}

export function sessionHours(): number {
  const n = Number(process.env.DASHBOARD_SESSION_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 12;
}
