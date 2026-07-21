/**
 * In-memory mock state for MOCK=1 mode.
 *
 * The live unit persists settings you PUT; a stateless mock that just echoes
 * the body back can't demonstrate a save→apply→see-it-in-the-preview loop.
 * This module gives mock mode just enough persistence for that: a PUT to
 * `video_mixers/{i}/settings` is retained in process memory, later GETs return
 * it, and the mock program thumbnail is rendered from it — so applying a 2×2
 * quad in the builder is reflected in the mixer preview without ever touching
 * the real unit.
 *
 * Scope/lifetime: process-local and non-persistent (lost on restart, not
 * shared across serverless instances). That's intentional — it exists only to
 * make local mock development realistic, never as a real datastore.
 */

import type { VideoMixerSettings, VideoMixerSettingsResponse } from "../types";
import { mockVideoMixerSettings } from "./data";

/** Base (default) settings per mixer index, before any PUT. */
const BASE_MIXER_SETTINGS: Record<number, VideoMixerSettingsResponse> = {
  0: mockVideoMixerSettings,
};

/** Retained bodies from PUT /video_mixers/{index}/settings. */
const mixerOverrides = new Map<number, VideoMixerSettings>();

/**
 * Store a settings body PUT by the client. `_constraints`/`_messages`/`_links`
 * are dropped — the client shouldn't send them back, and we always re-attach
 * fresh `_constraints` from the base on read.
 */
export function putMixerSettings(index: number, body: unknown): void {
  if (!body || typeof body !== "object") return;
  const clone = structuredClone(body) as Record<string, unknown>;
  delete clone._constraints;
  delete clone._messages;
  delete clone._links;
  mixerOverrides.set(index, clone as unknown as VideoMixerSettings);
}

/**
 * Current settings for a mixer index: the retained PUT body if present,
 * otherwise the base mock — always carrying the base `_constraints` and a
 * bumped `_version` so an applied change is observable.
 */
export function currentMixerSettings(index: number): VideoMixerSettingsResponse {
  const base = BASE_MIXER_SETTINGS[index];
  if (!base) {
    // Unknown index — return an empty-but-valid shape so callers don't crash.
    return {
      description: "",
      active: false,
      video_sources: [],
      video_out: { sd_aspect_ratio: "16:9" },
      program: { layers: [] },
    } as VideoMixerSettingsResponse;
  }
  const override = mixerOverrides.get(index);
  if (!override) return base;
  return {
    ...base,
    ...override,
    _constraints: base._constraints,
    _version: `mock-applied-${mixerOverrides.size ? "1" : "0"}`,
  };
}

/** Test/reset hook. */
export function resetMockState(): void {
  mixerOverrides.clear();
}
