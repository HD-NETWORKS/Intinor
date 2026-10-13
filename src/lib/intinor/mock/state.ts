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

/** Uploaded binary blobs (e.g. test_picture/custom_background) — not JSON, so kept separately from `overrides`. */
const binaryOverrides = new Map<string, { bytes: ArrayBuffer; contentType: string }>();

export function putBinaryOverride(key: string, bytes: ArrayBuffer, contentType: string): void {
  binaryOverrides.set(key, { bytes, contentType });
}

export function getBinaryOverride(key: string): { bytes: ArrayBuffer; contentType: string } | undefined {
  return binaryOverrides.get(key);
}

/**
 * Membership tracking for a mock list resource whose *set* of items can
 * change (unlike encoders/inputs/mixers, which are fixed-count — see the
 * module doc above). `listKey` is caller-defined (e.g. "users"); `id` is
 * whatever identifies an item (e.g. a username). Two maps rather than one
 * "current membership" set because a built-in item (seeded in mock/data.ts,
 * never "added") still needs to be removable.
 */
const addedIds = new Map<string, Set<string>>();
const removedIds = new Map<string, Set<string>>();

export function addListId(listKey: string, id: string): void {
  if (!addedIds.has(listKey)) addedIds.set(listKey, new Set());
  addedIds.get(listKey)!.add(id);
  removedIds.get(listKey)?.delete(id);
}

export function removeListId(listKey: string, id: string): void {
  if (!removedIds.has(listKey)) removedIds.set(listKey, new Set());
  removedIds.get(listKey)!.add(id);
  // Forget it entirely if it was only ever mock-created (never a seeded
  // built-in) — deleting-then-recreating the same id should behave like
  // creating it fresh, not like un-deleting.
  addedIds.get(listKey)?.delete(id);
}

export function addedListIds(listKey: string): string[] {
  return Array.from(addedIds.get(listKey) ?? []);
}

export function isRemoved(listKey: string, id: string): boolean {
  return removedIds.get(listKey)?.has(id) ?? false;
}

/** Test/reset hook. */
export function resetMockState(): void {
  overrides.clear();
  binaryOverrides.clear();
  addedIds.clear();
  removedIds.clear();
}
