/**
 * Pure helpers for the video-mixer layout builder — no React, no I/O.
 *
 * Coordinate model (from the unit's API, docs/01-intinor-api-reference.md):
 *   layout.x / layout.y  = top-left position of the layer in the output frame,
 *                          normalized (0 = left/top edge, 1 = right/bottom edge)
 *   layout.zoom          = layer size as a fraction of the full frame
 *                          (0.5 = half width & half height, 1.0 = full frame)
 * So a 2×2 quad = four layers at zoom 0.5, positioned at the four corners.
 */

import type {
  RequestMetadata,
  VideoMixerLayerLayoutConstraints,
  VideoMixerLayerSettings,
  VideoMixerOutputSettingsConstraints,
  VideoMixerSettings,
  VideoMixerSettingsResponse,
  VideoSourceConstraint,
} from "./intinor/types.ts";

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

export const DEFAULT_LAYOUT_CONSTRAINTS: VideoMixerLayerLayoutConstraints = {
  x: { min: -1, max: 1 },
  y: { min: -1, max: 1 },
  zoom: { min: 0.05, max: 2 },
};

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Round to 3 decimals to keep PUT bodies tidy and diff-stable. */
export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function clampLayout(
  layout: { x: number; y: number; zoom: number },
  c: VideoMixerLayerLayoutConstraints = DEFAULT_LAYOUT_CONSTRAINTS,
): { x: number; y: number; zoom: number } {
  return {
    x: round3(clamp(layout.x, c.x.min, c.x.max)),
    y: round3(clamp(layout.y, c.y.min, c.y.max)),
    zoom: round3(clamp(layout.zoom, c.zoom.min, c.zoom.max)),
  };
}

export function layoutConstraintsFrom(
  c: VideoMixerOutputSettingsConstraints | undefined,
): VideoMixerLayerLayoutConstraints {
  return c?.layers?.layout ?? DEFAULT_LAYOUT_CONSTRAINTS;
}

export function maxLayersFrom(c: VideoMixerOutputSettingsConstraints | undefined): number {
  return c?.layers?.array_size?.max ?? 8;
}

export function sourceOptionsFrom(
  c: VideoMixerOutputSettingsConstraints | undefined,
): VideoSourceConstraint[] {
  return c?.layers?.input?.source ?? [];
}

// ---------------------------------------------------------------------------
// Per-layer enable/disable — a dashboard-only concept. The unit's own API has
// no notion of a "disabled" layer: a layer either exists in `program.layers`
// or it doesn't. Disabling one here keeps its source/position configured in
// the editor (and in any saved profile) while excluding it from what's
// actually sent on Apply — useful for temporarily pulling a source out of the
// composited output without losing how it was set up.
// ---------------------------------------------------------------------------

export type EditableLayer = VideoMixerLayerSettings & { enabled: boolean };

/** Layers as loaded from the unit are all considered enabled. */
export function withEnabled(layers: VideoMixerLayerSettings[]): EditableLayer[] {
  return layers.map((l) => ({ ...l, enabled: (l as Partial<EditableLayer>).enabled ?? true }));
}

/** Strip the dashboard-only `enabled` flag before building a PUT body. */
export function stripEnabled(layers: EditableLayer[]): VideoMixerLayerSettings[] {
  return layers.map(({ layout, input }) => ({ layout, input }));
}

// ---------------------------------------------------------------------------
// Source classification (live feed vs. filler)
// ---------------------------------------------------------------------------

/** A "feed" is a real ingest (network/video input), as opposed to test_picture. */
export function isFeedSource(source: string | undefined): boolean {
  if (!source) return false;
  return /\/(network_inputs|video_inputs)\/\d+/.test(source);
}

export interface SlotCoverage {
  total: number;
  liveFeeds: number;
  fillers: number;
  empty: number;
}

/**
 * Summarize how many layers point at a live feed vs. a filler vs. nothing —
 * drives the honest "N of M slots have a live source" banner instead of
 * pretending every quad cell has its own camera.
 */
export function slotCoverage(
  layers: VideoMixerLayerSettings[],
  availableFeeds: Set<string>,
): SlotCoverage {
  let liveFeeds = 0;
  let fillers = 0;
  let empty = 0;
  for (const layer of layers) {
    const src = layer.input?.source;
    if (!src) empty++;
    else if (isFeedSource(src) && availableFeeds.has(src)) liveFeeds++;
    else fillers++;
  }
  return { total: layers.length, liveFeeds, fillers, empty };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export type PresetId = "single" | "quad" | "pip" | "big-3-small" | "side-by-side";

export interface PresetDef {
  id: PresetId;
  name: string;
  description: string;
  /** Number of layer slots this preset lays out. */
  slots: number;
  /** Layout for each slot (top-left position + zoom). */
  layouts: Array<{ x: number; y: number; zoom: number }>;
}

export const PRESETS: PresetDef[] = [
  {
    id: "single",
    name: "Single",
    description: "One full-frame source.",
    slots: 1,
    layouts: [{ x: 0, y: 0, zoom: 1 }],
  },
  {
    id: "quad",
    name: "2×2 Quad",
    description: "Four equal cells.",
    slots: 4,
    layouts: [
      { x: 0, y: 0, zoom: 0.5 },
      { x: 0.5, y: 0, zoom: 0.5 },
      { x: 0, y: 0.5, zoom: 0.5 },
      { x: 0.5, y: 0.5, zoom: 0.5 },
    ],
  },
  {
    id: "pip",
    name: "Picture-in-picture",
    description: "Full-frame base with a small inset, bottom-right.",
    slots: 2,
    layouts: [
      { x: 0, y: 0, zoom: 1 },
      { x: 0.68, y: 0.66, zoom: 0.3 },
    ],
  },
  {
    id: "big-3-small",
    name: "1 big + 3 small",
    description: "A large main pane with three stacked side panes.",
    slots: 4,
    layouts: [
      { x: 0, y: 0, zoom: 0.75 },
      { x: 0.75, y: 0, zoom: 0.25 },
      { x: 0.75, y: 0.25, zoom: 0.25 },
      { x: 0.75, y: 0.5, zoom: 0.25 },
    ],
  },
  {
    id: "side-by-side",
    name: "Side by side",
    description: "Two half-width panes, centred vertically.",
    slots: 2,
    layouts: [
      { x: 0, y: 0.25, zoom: 0.5 },
      { x: 0.5, y: 0.25, zoom: 0.5 },
    ],
  },
];

/**
 * Build layers for a preset. Sources are assigned by priority — available live
 * feeds first (so the single real input lands in slot 0), then a filler for
 * every remaining slot. Never invents feeds that don't exist.
 */
export function buildPresetLayers(
  preset: PresetDef,
  feedSources: string[],
  fillerSource: string,
): VideoMixerLayerSettings[] {
  return preset.layouts.map((layout, i) => ({
    layout: { ...layout },
    input: { source: i < feedSources.length ? feedSources[i] : fillerSource },
  }));
}

// ---------------------------------------------------------------------------
// Prepare a settings response for a PUT
// ---------------------------------------------------------------------------

/**
 * Turn a fetched settings response into a valid PUT body carrying new program
 * layers. Per the API's forward-compat rules we send unknown fields back
 * unmodified but strip `_constraints`/`_messages`/`_links`, and echo `_version`
 * if the unit provided one. Only `program` is replaced — existing
 * `layout_profiles`/`source_profiles` on the unit are preserved as-is.
 */
export function prepareMixerPut(
  current: VideoMixerSettingsResponse,
  layers: VideoMixerLayerSettings[],
): VideoMixerSettings & RequestMetadata {
  const clone = structuredClone(current) as unknown as Record<string, unknown>;
  delete clone._constraints;
  delete clone._messages;
  delete clone._links;

  const next = clone as unknown as VideoMixerSettings & RequestMetadata;
  next.program = {
    ...(current.program ?? { layers: [] }),
    layers,
  };
  return next;
}
