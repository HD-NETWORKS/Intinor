/**
 * Named mixer layout profiles — a dashboard-level concept, persisted in
 * localStorage.
 *
 * Why not the unit's own `layout_profiles` array? The API's `layout_profiles`
 * hold *only* per-layer x/y/zoom — no name, and no source assignment (sources
 * live in the separate, also-unnamed `source_profiles`). A useful "Sunday
 * service quad" preset needs a name *and* which source goes in which cell, so
 * the full named profile is kept here. Applying a profile pushes the composed
 * `program` (layouts + sources) to the unit and leaves the unit's own
 * `layout_profiles`/`source_profiles` untouched (see prepareMixerPut) — we
 * don't clobber whatever the stock IDM console may have stored there.
 *
 * Per-unit keyed so multi-unit support (later) doesn't collide.
 */

import type { VideoMixerLayerSettings } from "./intinor/types";

export interface MixerProfile {
  id: string;
  name: string;
  /** Full program capture: layer layouts + source assignments. */
  layers: VideoMixerLayerSettings[];
  createdAt: number;
}

const KEY_PREFIX = "intinor.mixerProfiles";

function storageKey(unitId: string, mixerIndex: number): string {
  return `${KEY_PREFIX}.${unitId}.${mixerIndex}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadProfiles(unitId: string, mixerIndex: number): MixerProfile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(unitId, mixerIndex));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MixerProfile[]) : [];
  } catch {
    return [];
  }
}

function saveAll(unitId: string, mixerIndex: number, profiles: MixerProfile[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(storageKey(unitId, mixerIndex), JSON.stringify(profiles));
}

export function saveProfile(
  unitId: string,
  mixerIndex: number,
  name: string,
  layers: VideoMixerLayerSettings[],
): MixerProfile[] {
  const profiles = loadProfiles(unitId, mixerIndex);
  const trimmed = name.trim();
  const existing = profiles.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  const layersClone = structuredClone(layers);
  if (existing) {
    existing.layers = layersClone;
    existing.createdAt = Date.now();
  } else {
    profiles.push({
      id: `prof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      layers: layersClone,
      createdAt: Date.now(),
    });
  }
  saveAll(unitId, mixerIndex, profiles);
  return profiles;
}

export function deleteProfile(
  unitId: string,
  mixerIndex: number,
  id: string,
): MixerProfile[] {
  const profiles = loadProfiles(unitId, mixerIndex).filter((p) => p.id !== id);
  saveAll(unitId, mixerIndex, profiles);
  return profiles;
}
