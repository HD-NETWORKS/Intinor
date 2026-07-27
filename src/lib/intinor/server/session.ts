import "server-only";
import type { UserSession } from "../types";
import { getUnitConfig } from "./config";

/**
 * Session management against the unit's API — one cache entry per unit id, so
 * a second unit gets its own session lifecycle without touching this module.
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

interface UnitSessionState {
  sessionId: string | null;
  pending: Promise<string> | null;
}

const sessions = new Map<string, UnitSessionState>();

function stateFor(unitId: string): UnitSessionState {
  let state = sessions.get(unitId);
  if (!state) {
    state = { sessionId: null, pending: null };
    sessions.set(unitId, state);
  }
  return state;
}

function basicAuth(user: string, secret: string): string {
  return "Basic " + Buffer.from(`${user}:${secret}`).toString("base64");
}

async function createSession(unitId: string): Promise<string> {
  const { baseUrl, username, password } = getUnitConfig(unitId);
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
      `Failed to open session on unit '${unitId}' (${res.status} ${res.statusText})`,
    );
  }
  const session = (await res.json()) as UserSession;
  if (!session.session_id) {
    throw new Error(`Unit '${unitId}' session response did not include a session_id`);
  }
  return session.session_id;
}

export async function getSessionAuthHeader(unitId: string): Promise<string> {
  const { username } = getUnitConfig(unitId);
  const state = stateFor(unitId);
  if (!state.sessionId) {
    // Deduplicate concurrent session creation for this unit.
    state.pending ??= createSession(unitId).finally(() => {
      state.pending = null;
    });
    state.sessionId = await state.pending;
  }
  return basicAuth(username, state.sessionId);
}

/** Call when the unit answers 401 — forces a fresh session on next request. */
export function invalidateSession(unitId: string): void {
  const state = sessions.get(unitId);
  if (state) state.sessionId = null;
}
