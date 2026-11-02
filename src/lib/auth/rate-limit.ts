/**
 * Best-effort, in-memory login throttle — process-local and non-persistent,
 * same posture as mock/state.ts's overrides (lost on a cold start, not
 * shared across concurrent serverless instances). That's an honest
 * limitation, not an oversight: this app has no Redis/KV configured for a
 * real distributed rate limit, and isn't about to gain one just for this.
 * What it still buys: a scripted brute-force run hitting one warm instance
 * repeatedly — the realistic threat against a small-team internal tool —
 * gets meaningfully slowed down instead of running at full speed.
 */

const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;

interface Entry {
  count: number;
  windowStart: number;
}

const attempts = new Map<string, Entry>();

function expired(entry: Entry, now: number): boolean {
  return now - entry.windowStart > WINDOW_MS;
}

export function isLoginRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  const now = Date.now();
  if (expired(entry, now)) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || expired(entry, now)) {
    attempts.set(key, { count: 1, windowStart: now });
  } else {
    entry.count++;
  }
  // Opportunistic cleanup so this Map doesn't grow unboundedly on a
  // long-lived warm instance — piggybacks on the one path that's already
  // called on every request, rather than a separate timer.
  for (const [k, e] of attempts) {
    if (expired(e, now)) attempts.delete(k);
  }
}

/** Called after a successful login so a legitimate user who mistyped their
 *  password a few times isn't left halfway to a lockout. */
export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}

/** Test-only reset hook, mirroring mock/state.ts's resetMockState(). */
export function resetRateLimitState(): void {
  attempts.clear();
}
