/**
 * Deterministic per-tick jitter for mock status data.
 *
 * Values change once every TICK_MS so a polling UI actually sees movement
 * (bitrate, CPU, etc.), while staying byte-identical *within* a tick — which
 * lets the mock ETag/If-None-Match path produce real 304s, the same way a
 * slow-changing value on the live unit would.
 */

const TICK_MS = 15_000;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function mulberry32(seed: number): number {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function currentTick(): number {
  return Math.floor(Date.now() / TICK_MS);
}

/** Deterministic pseudo-random fraction in [0, 1), stable within one tick. */
export function seededFraction(key: string, tick: number = currentTick()): number {
  return mulberry32(hashString(key) ^ tick);
}

/** Deterministic jitter in [-amplitude, +amplitude], stable within one tick. */
export function jitter(key: string, amplitude: number, tick: number = currentTick()): number {
  return (seededFraction(key, tick) * 2 - 1) * amplitude;
}

export function jitteredValue(
  key: string,
  base: number,
  amplitude: number,
  tick: number = currentTick(),
): number {
  return base + jitter(key, amplitude, tick);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
