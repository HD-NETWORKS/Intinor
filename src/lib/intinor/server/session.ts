import "server-only";
import type { UserSession } from "../types";
import { getUnitConfig } from "./config";

/**
 * Session management against the unit's API.
 *
 * The real password is only ever used here, to mint a temporary session id
 * via POST /users/{username}/sessions. All other requests authenticate as
 * `username:session_id`. The session id stays in server memory — it is never
 * sent to the browser.
 *
 * Note on serverless (Vercel): this cache is per-lambda-instance. Cold starts
 * mint a fresh session, which the unit allows; stale sessions eventually age
 * out on the unit side.
 */

let cachedSessionId: string | null = null;
let pending: Promise<string> | null = null;

function basicAuth(user: string, secret: string): string {
  return "Basic " + Buffer.from(`${user}:${secret}`).toString("base64");
}

async function createSession(): Promise<string> {
  const { baseUrl, username, password } = getUnitConfig();
  const res = await fetch(
    `${baseUrl}/users/${encodeURIComponent(username)}/sessions`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(username, password),
        "X-No-Basic-Auth": "1",
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to open session on unit (${res.status} ${res.statusText})`,
    );
  }
  const session = (await res.json()) as UserSession;
  if (!session.session_id) {
    throw new Error("Unit session response did not include a session_id");
  }
  return session.session_id;
}

export async function getSessionAuthHeader(): Promise<string> {
  const { username } = getUnitConfig();
  if (!cachedSessionId) {
    // Deduplicate concurrent session creation
    pending ??= createSession().finally(() => {
      pending = null;
    });
    cachedSessionId = await pending;
  }
  return basicAuth(username, cachedSessionId);
}

/** Call when the unit answers 401 — forces a fresh session on next request. */
export function invalidateSession(): void {
  cachedSessionId = null;
}
