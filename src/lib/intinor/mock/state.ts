/**
 * In-memory mock state for MOCK=1 mode.
 *
 * The live unit persists settings you PUT; a stateless mock that just echoes
 * the body back can't demonstrate a save → reload → still-there loop. This
 * module gives mock mode just enough persistence for that: a generic
 * key → override-body store, keyed by whatever the caller supplies (resolve.ts
 * uses `unitId/kind/index`, so the default unit and any synthetic extra unit
 * — see bigUnit.ts — never share an override).
 *
 * Scope/lifetime: process-local and non-persistent (lost on restart, not
 * shared across serverless instances). That's intentional — it exists only to
 * make local mock development realistic, never as a real datastore.
 */

const overrides = new Map<string, Record<string, unknown>>();

/**
 * Store a settings body PUT by the client, keyed by `key`.
 * `_constraints`/`_messages`/`_links` are dropped — the client shouldn't send
 * them back, and callers always re-attach fresh `_constraints` from their own
 * base on read.
 */
export function putOverride(key: string, body: unknown): void {
  if (!body || typeof body !== "object") return;
  const clone = structuredClone(body) as Record<string, unknown>;
  delete clone._constraints;
  delete clone._messages;
  delete clone._links;
  overrides.set(key, clone);
}

/**
 * `base` merged with any retained override for `key` — always carrying
 * base's own `_constraints` (the unit recomputes those; a client can't change
 * its own permissions by PUTing them) and a `_version` that changes once
 * something has been applied.
 */
export function currentWithOverride<T extends { _constraints?: unknown }>(
  key: string,
  base: T,
): T {
  const override = overrides.get(key);
  if (!override) return base;
  return {
    ...base,
    ...override,
    _constraints: base._constraints,
    _version: `mock-applied-${overrides.size}`,
  } as T;
}

/** Test/reset hook. */
export function resetMockState(): void {
  overrides.clear();
}
