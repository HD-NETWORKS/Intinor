/**
 * In-memory mock state for MOCK=1 mode.
 *
 * The live unit persists settings you PUT; a stateless mock that just echoes
 * the body back can't demonstrate a save → reload → still-there loop. This
 * module gives mock mode just enough persistence for that: a PUT to any
 * supported `.../settings` path is retained in process memory, later GETs
 * return it, and the mock mixer thumbnail is rendered from it — so editing
 * settings or applying a quad layout behaves like the real thing without ever
 * touching the unit.
 *
 * Scope/lifetime: process-local and non-persistent (lost on restart, not
 * shared across serverless instances). That's intentional — it exists only to
 * make local mock development realistic, never as a real datastore.
 */

import type {
  EncoderSettingsResponse,
  NetworkInputSettingsResponse,
  VideoMixerSettings,
  VideoMixerSettingsResponse,
} from "../types";
import {
  mockEncoderSettings,
  mockNetworkInputSettings,
  mockVideoMixerSettings,
} from "./data";

export type SettingsKind = "encoders" | "network_inputs" | "video_mixers";

type AnySettings =
  | EncoderSettingsResponse
  | NetworkInputSettingsResponse
  | VideoMixerSettingsResponse;

/** Base (default) settings per kind + index, before any PUT. */
const BASE: Record<SettingsKind, Record<number, AnySettings>> = {
  encoders: { 0: mockEncoderSettings },
  network_inputs: { 0: mockNetworkInputSettings },
  video_mixers: { 0: mockVideoMixerSettings },
};

/** Retained bodies from PUT, keyed `kind/index`. */
const overrides = new Map<string, Record<string, unknown>>();

function key(kind: SettingsKind, index: number): string {
  return `${kind}/${index}`;
}

/**
 * Store a settings body PUT by the client. `_constraints`/`_messages`/`_links`
 * are dropped — the client shouldn't send them back, and we always re-attach
 * fresh `_constraints` from the base on read.
 */
export function putSettings(kind: SettingsKind, index: number, body: unknown): void {
  if (!body || typeof body !== "object") return;
  const clone = structuredClone(body) as Record<string, unknown>;
  delete clone._constraints;
  delete clone._messages;
  delete clone._links;
  overrides.set(key(kind, index), clone);
}

/**
 * Current settings: the retained PUT body if present, otherwise the base mock
 * — always carrying the base `_constraints` (the unit recomputes those; a
 * client can't change its own permissions by PUTing them) and a `_version`
 * that changes once something has been applied.
 */
export function currentSettings(kind: SettingsKind, index: number): AnySettings {
  const base = BASE[kind]?.[index];
  if (!base) {
    return { description: "", active: false } as unknown as AnySettings;
  }
  const override = overrides.get(key(kind, index));
  if (!override) return base;
  return {
    ...base,
    ...override,
    _constraints: base._constraints,
    _version: `mock-applied-${overrides.size}`,
  } as AnySettings;
}

/** Mixer-specific convenience wrappers (used by the program thumbnail). */
export function currentMixerSettings(index: number): VideoMixerSettingsResponse {
  return currentSettings("video_mixers", index) as VideoMixerSettingsResponse;
}
export function putMixerSettings(index: number, body: unknown): void {
  putSettings("video_mixers", index, body as VideoMixerSettings);
}

/** Test/reset hook. */
export function resetMockState(): void {
  overrides.clear();
}
