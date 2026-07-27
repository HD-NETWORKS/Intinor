import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { authCredentials, sessionHours } from "./config";

/**
 * Stateless, HMAC-signed session cookie — no session store needed for one
 * shared operator account. `payload.signature`, both base64url:
 *   payload   = base64url(JSON.stringify({ exp }))
 *   signature = HMAC-SHA256(payload, AUTH_SECRET)
 *
 * Verification recomputes the HMAC and compares with a constant-time check
 * (`timingSafeEqual`) rather than `===`, so response timing can't be used to
 * guess a valid signature byte-by-byte.
 */

export const SESSION_COOKIE_NAME = "dashboard_session";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function sessionMaxAgeSeconds(): number {
  return sessionHours() * 3600;
}

/** Returns null if auth isn't configured — callers must treat that as "can't log in". */
export function createSessionCookieValue(): string | null {
  const creds = authCredentials();
  if (!creds) return null;
  const exp = Date.now() + sessionHours() * 3600_000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${payload}.${sign(payload, creds.secret)}`;
}

export function verifySessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const creds = authCredentials();
  if (!creds) return false;

  const dot = value.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!safeEqual(sig, sign(payload, creds.secret))) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function verifyCredentials(username: string, password: string): boolean {
  const creds = authCredentials();
  if (!creds) return false;
  return safeEqual(username, creds.username) && safeEqual(password, creds.password);
}
