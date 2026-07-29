/**
 * Route matcher for MOCK=1 mode: maps unit-relative API paths to mock
 * payloads. GETs return canned data (with a computed ETag honoring
 * If-None-Match, and slow per-tick jitter on status endpoints so a polling
 * UI sees real movement); writes echo the request body back (the
 * GET→modify→PUT pattern succeeds without touching any hardware).
 */

import { createHash } from "node:crypto";
import type {
  EncoderStatus,
  NetworkInputStatus,
  NetworkInterfacesList,
  SystemStatus,
} from "../types";
import {
  mockApiRoot,
  mockEncoder,
  mockEncodersList,
  mockEncoderSettings,
  mockEncoderStatus,
  mockEncodingModes,
  mockNetworkInput,
  mockNetworkInputsList,
  mockNetworkInputSettings,
  mockNetworkInputStatus,
  mockNetworkInterfaces,
  mockSystem,
  mockSystemStatus,
  mockVideoMixer,
  mockVideoMixersList,
  mockVideoMixerSettings,
  mockVideoMixerStatus,
} from "./data";
import { clamp, currentTick, jitteredValue, seededFraction } from "./jitter";
import { currentWithOverride, putOverride } from "./state";
import { withMockPermissions } from "./permissions";
import {
  faultEncoderStatus,
  faultInputStatus,
  faultInterfaces,
  faultStorageStatus,
  faultSystemStatus,
} from "./faults";
import {
  BIG_ENCODER_COUNT,
  BIG_INPUT_COUNT,
  bigEncoder,
  bigEncoderStatus,
  bigEncodersList,
  bigNetworkInput,
  bigNetworkInputStatus,
  bigNetworkInputsList,
  bigVideoMixerSettings,
  bigVideoMixersList,
} from "./bigUnit";
import { defaultUnitId } from "../server/config";
import type {
  EncoderSettingsResponse,
  NetworkInputSettingsResponse,
  VideoMixerLayerSettings,
  VideoMixerSettingsResponse,
} from "../types";

type SettingsKind = "encoders" | "network_inputs" | "video_mixers";
type AnySettings =
  | EncoderSettingsResponse
  | NetworkInputSettingsResponse
  | VideoMixerSettingsResponse;

/** Is this unit id the synthetic "big" fixture rather than the primary mock unit? */
function isBigUnit(unitId?: string): boolean {
  return Boolean(unitId) && unitId !== defaultUnitId();
}

/** The un-overridden settings for a resource — different base for the big unit's mixer (more sources). */
function baseSettingsFor(kind: SettingsKind, index: number, unitId?: string): AnySettings {
  if (kind === "video_mixers" && index === 0 && isBigUnit(unitId)) {
    return bigVideoMixerSettings();
  }
  const table: Record<SettingsKind, AnySettings> = {
    encoders: mockEncoderSettings,
    network_inputs: mockNetworkInputSettings,
    video_mixers: mockVideoMixerSettings,
  };
  return table[kind];
}

function settingsKey(kind: SettingsKind, index: number, unitId?: string): string {
  return `${unitId ?? defaultUnitId()}/${kind}/${index}`;
}

/** Current settings for a resource: the retained PUT override, or its base — scoped per unit. */
function currentSettings(kind: SettingsKind, index: number, unitId?: string): AnySettings {
  return currentWithOverride(settingsKey(kind, index, unitId), baseSettingsFor(kind, index, unitId));
}

function putSettings(kind: SettingsKind, index: number, body: unknown, unitId?: string): void {
  putOverride(settingsKey(kind, index, unitId), body);
}

function currentMixerSettings(index: number, unitId?: string): VideoMixerSettingsResponse {
  return currentSettings("video_mixers", index, unitId) as VideoMixerSettingsResponse;
}

export interface MockResponse {
  status: number;
  body: unknown;
  contentType?: string;
  etag?: string;
}

// ---------------------------------------------------------------------------
// Live (jittered) status builders — same shape as the static mocks, but with
// a few numeric fields nudged deterministically per 15s tick.
// ---------------------------------------------------------------------------

function liveSystemStatus(): SystemStatus {
  return faultSystemStatus(baseSystemStatus());
}

function baseSystemStatus(): SystemStatus {
  // Tick-derived, not wall-clock: must stay byte-identical within a tick so
  // the ETag is stable and 304s actually happen between ticks.
  return {
    ...mockSystemStatus,
    datetime: new Date(currentTick() * 15_000).toISOString(),
    cpu: mockSystemStatus.cpu
      ? { usage: clamp(jitteredValue("cpu", mockSystemStatus.cpu.usage, 9), 2, 96) }
      : undefined,
    battery: mockSystemStatus.battery
      ? {
          ...mockSystemStatus.battery,
          charge:
            mockSystemStatus.battery.charge != null
              ? Math.round(clamp(jitteredValue("battery", mockSystemStatus.battery.charge, 1.2), 0, 100))
              : mockSystemStatus.battery.charge,
        }
      : undefined,
  };
}

function liveNetworkInputStatus(): NetworkInputStatus {
  return faultInputStatus(baseNetworkInputStatus());
}

function baseNetworkInputStatus(): NetworkInputStatus {
  const base = mockNetworkInputStatus;
  const bitrate = base.network_source.bitrate
    ? Math.round(clamp(jitteredValue("ni-bitrate", base.network_source.bitrate, 350_000), 0, Infinity))
    : base.network_source.bitrate;
  return {
    ...base,
    network_source: {
      ...base.network_source,
      bitrate,
      packet_loss: base.network_source.packet_loss
        ? Math.max(0, clamp(jitteredValue("ni-loss", base.network_source.packet_loss, 0.03), 0, 2))
        : base.network_source.packet_loss,
    },
  };
}

function liveEncoderStatus(): EncoderStatus {
  return faultEncoderStatus(baseEncoderStatus());
}

function baseEncoderStatus(): EncoderStatus {
  const base = mockEncoderStatus;
  const totalBitrate = base.encoding.total_bitrate
    ? Math.round(clamp(jitteredValue("enc-bitrate", base.encoding.total_bitrate, 250_000), 0, Infinity))
    : base.encoding.total_bitrate;
  return {
    ...base,
    encoding: { ...base.encoding, total_bitrate: totalBitrate },
    destinations: {
      ...base.destinations,
      basic: base.destinations.basic.map((dest) => ({
        ...dest,
        bitrate: Math.round(clamp(jitteredValue(`dest-${dest.id}`, dest.bitrate, 300_000), 0, Infinity)),
        packet_loss:
          dest.packet_loss != null
            ? Math.max(0, clamp(jitteredValue(`dest-loss-${dest.id}`, dest.packet_loss, 0.02), 0, 2))
            : dest.packet_loss,
      })),
    },
  };
}

function liveNetworkInterfaces(): NetworkInterfacesList {
  return faultInterfaces(baseNetworkInterfaces());
}

function baseNetworkInterfaces(): NetworkInterfacesList {
  const base = mockNetworkInterfaces;
  return {
    ...base,
    status: base.status
      ? {
          ...base.status,
          status: base.status.status.map((iface, i) => ({
            ...iface,
            rx_bitrate: Math.round(clamp(jitteredValue(`if${i}-rx`, iface.rx_bitrate, iface.rx_bitrate ? 400_000 : 0), 0, Infinity)),
            tx_bitrate: Math.round(clamp(jitteredValue(`if${i}-tx`, iface.tx_bitrate, iface.tx_bitrate ? 400_000 : 0), 0, Infinity)),
          })),
        }
      : base.status,
  };
}

// ---------------------------------------------------------------------------
// GET routes
// ---------------------------------------------------------------------------

/** Exact path (after trimming slashes) → payload factory. */
const GET_ROUTES: Record<string, () => unknown> = {
  "": () => mockApiRoot,
  system: () => mockSystem,
  "system/status": () => liveSystemStatus(),
  "system/messages": () => ({ messages: [] }),
  encoders: () => mockEncodersList,
  "encoders/0": () => ({
    ...mockEncoder,
    settings: withMockPermissions(currentSettings("encoders", 0), "encoder"),
    status: liveEncoderStatus(),
    thumbnails: {
      thumbnails: [{ id: "video_source", href: "encoders/0/thumbnails/video_source" }],
    },
  }),
  "encoders/0/settings": () =>
    withMockPermissions(currentSettings("encoders", 0), "encoder"),
  "encoders/0/status": () => liveEncoderStatus(),
  "encoders/0/thumbnails": () => ({
    thumbnails: [{ id: "video_source", href: "encoders/0/thumbnails/video_source" }],
  }),
  network_inputs: () => mockNetworkInputsList,
  "network_inputs/0": () => ({
    ...mockNetworkInput,
    settings: withMockPermissions(currentSettings("network_inputs", 0), "network_input"),
    status: liveNetworkInputStatus(),
    thumbnails: {
      thumbnails: [{ id: "program_1", href: "network_inputs/0/thumbnails/program_1" }],
    },
  }),
  "network_inputs/0/settings": () =>
    withMockPermissions(currentSettings("network_inputs", 0), "network_input"),
  "network_inputs/0/status": () => liveNetworkInputStatus(),
  "network_inputs/0/thumbnails": () => ({
    thumbnails: [{ id: "program_1", href: "network_inputs/0/thumbnails/program_1" }],
  }),
  video_mixers: () => mockVideoMixersList,
  "video_mixers/0": () => ({
    ...mockVideoMixer,
    settings: withMockPermissions(currentMixerSettings(0), "video_mixer"),
    status: mockVideoMixerStatus,
    thumbnails: {
      thumbnails: [{ id: "program", href: "video_mixers/0/thumbnails/program" }],
    },
  }),
  "video_mixers/0/settings": () =>
    withMockPermissions(currentMixerSettings(0), "video_mixer"),
  "video_mixers/0/status": () => mockVideoMixerStatus,
  "video_mixers/0/thumbnails": () => ({
    thumbnails: [{ id: "program", href: "video_mixers/0/thumbnails/program" }],
  }),
  network_interfaces: () => liveNetworkInterfaces(),
  "storage/status": () => faultStorageStatus(null) ?? { present: false, removable: false },
  encoding: () => ({ encoding_modes: mockEncodingModes }),
  "encoding/encoding_modes": () => mockEncodingModes,
  multiviews: () => ({ multiviews: [] }),
  video_inputs: () => ({ video_inputs: [] }),
  video_outputs: () => ({ video_outputs: [] }),
  profiles: () => ({ profiles: [] }),
};

/**
 * Same shape as GET_ROUTES, but for the synthetic "big" unit (see
 * mock/bigUnit.ts) — any mock unit id other than the primary one. Shared
 * paths (system, network interfaces, storage, encoding modes …) are
 * unit-agnostic and reused as-is; encoders/network_inputs are generated at
 * the big unit's actual pipe count.
 */
function bigGetRoutes(unitId: string): Record<string, () => unknown> {
  const routes: Record<string, () => unknown> = {
    "": () => mockApiRoot,
    system: () => mockSystem,
    "system/status": () => liveSystemStatus(),
    "system/messages": () => ({ messages: [] }),
    encoders: () => bigEncodersList(),
    network_inputs: () => bigNetworkInputsList(),
    video_mixers: () => bigVideoMixersList(),
    "video_mixers/0": () => ({
      ...mockVideoMixer,
      settings: withMockPermissions(currentMixerSettings(0, unitId), "video_mixer"),
      status: mockVideoMixerStatus,
      thumbnails: { thumbnails: [{ id: "program", href: "video_mixers/0/thumbnails/program" }] },
    }),
    "video_mixers/0/settings": () =>
      withMockPermissions(currentMixerSettings(0, unitId), "video_mixer"),
    "video_mixers/0/status": () => mockVideoMixerStatus,
    "video_mixers/0/thumbnails": () => ({
      thumbnails: [{ id: "program", href: "video_mixers/0/thumbnails/program" }],
    }),
    network_interfaces: () => liveNetworkInterfaces(),
    "storage/status": () => faultStorageStatus(null) ?? { present: false, removable: false },
    encoding: () => ({ encoding_modes: mockEncodingModes }),
    "encoding/encoding_modes": () => mockEncodingModes,
    multiviews: () => ({ multiviews: [] }),
    video_inputs: () => ({ video_inputs: [] }),
    video_outputs: () => ({ video_outputs: [] }),
    profiles: () => ({ profiles: [] }),
  };

  for (let i = 0; i < BIG_ENCODER_COUNT; i++) {
    routes[`encoders/${i}`] = () => ({
      ...bigEncoder(i),
      settings: withMockPermissions(currentSettings("encoders", i, unitId), "encoder"),
      status: bigEncoderStatus(i),
      thumbnails: {
        thumbnails: [{ id: "video_source", href: `encoders/${i}/thumbnails/video_source` }],
      },
    });
    routes[`encoders/${i}/settings`] = () =>
      withMockPermissions(currentSettings("encoders", i, unitId), "encoder");
    routes[`encoders/${i}/status`] = () => bigEncoderStatus(i);
    routes[`encoders/${i}/thumbnails`] = () => ({
      thumbnails: [{ id: "video_source", href: `encoders/${i}/thumbnails/video_source` }],
    });
  }

  for (let i = 0; i < BIG_INPUT_COUNT; i++) {
    routes[`network_inputs/${i}`] = () => ({
      ...bigNetworkInput(i),
      settings: withMockPermissions(currentSettings("network_inputs", i, unitId), "network_input"),
      status: bigNetworkInputStatus(i),
      thumbnails: {
        thumbnails: [{ id: "program_1", href: `network_inputs/${i}/thumbnails/program_1` }],
      },
    });
    routes[`network_inputs/${i}/settings`] = () =>
      withMockPermissions(currentSettings("network_inputs", i, unitId), "network_input");
    routes[`network_inputs/${i}/status`] = () => bigNetworkInputStatus(i);
    routes[`network_inputs/${i}/thumbnails`] = () => ({
      thumbnails: [{ id: "program_1", href: `network_inputs/${i}/thumbnails/program_1` }],
    });
  }

  return routes;
}

function computeEtag(body: unknown): string {
  const json = JSON.stringify(body);
  return `"${createHash("sha1").update(json).digest("hex").slice(0, 16)}"`;
}

// ---------------------------------------------------------------------------
// Thumbnails — SVG placeholder, resource-labelled, with an optional PPM
// (audio peak-meter) overlay so toggling the real option visibly does
// something even against mock data.
// ---------------------------------------------------------------------------

/** Colour + short label for a mixer layer source, by URI shape. */
function sourceStyle(source: string): { fill: string; label: string } {
  const ni = source.match(/network_inputs\/(\d+)/);
  if (ni) return { fill: "#1d4ed8", label: `IN ${ni[1]}` };
  const vi = source.match(/video_inputs\/(\d+)/);
  if (vi) return { fill: "#0f766e", label: `VID ${vi[1]}` };
  if (/test_picture/.test(source)) return { fill: "#475569", label: "TEST" };
  const seg = source.split("/").filter(Boolean).pop() ?? "SRC";
  return { fill: "#3f3f46", label: seg.slice(0, 8).toUpperCase() };
}

/**
 * Render the mixer's *applied* program (from mock state) as a composited SVG,
 * so applying a layout in the builder is reflected in the preview thumbnail.
 * Layers paint back-to-front in array order, matching the unit's compositor.
 */
function buildMixerProgramSvg(
  index: number,
  width: number,
  height: number,
  unitId?: string,
): MockResponse {
  const settings = currentMixerSettings(index, unitId);
  const layers: VideoMixerLayerSettings[] = settings.program?.layers ?? [];

  const boxes = layers
    .map((layer, i) => {
      const { x, y, zoom } = layer.layout;
      const bx = x * width;
      const by = y * height;
      const bw = zoom * width;
      const bh = zoom * height;
      const { fill, label } = sourceStyle(layer.input?.source ?? "");
      const fontSize = Math.max(9, Math.min(bw, bh) / 5);
      return `<g>
    <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${fill}" stroke="#0b0f17" stroke-width="2"/>
    <text x="${(bx + bw / 2).toFixed(1)}" y="${(by + bh / 2 + fontSize / 3).toFixed(1)}" fill="#e2e8f0" font-family="monospace" font-size="${fontSize.toFixed(1)}" text-anchor="middle">${label}</text>
    <text x="${(bx + 4).toFixed(1)}" y="${(by + 12).toFixed(1)}" fill="#94a3b8" font-family="monospace" font-size="9" text-anchor="start">L${i}</text>
  </g>`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0b0f17"/>
  ${boxes}
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="#1e293b" stroke-width="2"/>
  <text x="6" y="${height - 6}" fill="#334155" font-family="monospace" font-size="9">MOCK PROGRAM · ${layers.length} layer${layers.length === 1 ? "" : "s"}</text>
</svg>`;
  return { status: 200, body: svg, contentType: "image/svg+xml" };
}

function buildThumbnailSvg(
  path: string,
  searchParams: URLSearchParams,
  unitId?: string,
): MockResponse {
  const [resourceType, indexStr, , thumbId] = path.split("/");
  const width = Number(searchParams.get("width")) || 320;
  const height = Number(searchParams.get("height")) || Math.round((width * 9) / 16);
  const ppm = searchParams.get("ppm") === "true" || searchParams.get("ppm") === "1";
  const tick = currentTick();
  const label = `${resourceType.replace(/_/g, " ")} #${indexStr}`;

  // Mixer program thumbnails render the actual applied composition.
  if (resourceType === "video_mixers" && thumbId === "program") {
    return buildMixerProgramSvg(Number(indexStr), width, height, unitId);
  }

  let ppmBars = "";
  if (ppm) {
    const barCount = 12;
    const gap = 2;
    const barWidth = (width - 16) / barCount - gap;
    ppmBars = Array.from({ length: barCount }, (_, i) => {
      const level = 0.25 + 0.65 * seededFraction(`${path}-bar${i}`, tick);
      const barHeight = Math.round(level * (height - 24));
      const x = 8 + i * ((width - 16) / barCount);
      const color = level > 0.85 ? "#ef4444" : level > 0.6 ? "#facc15" : "#22c55e";
      return `<rect x="${x.toFixed(1)}" y="${(height - 12 - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight}" fill="${color}" />`;
    }).join("");
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#1a2233"/>
  <rect x="4" y="4" width="${width - 8}" height="${height - 8}" fill="none" stroke="#3b82f6" stroke-width="2" rx="4"/>
  <text x="${width / 2}" y="${height / 2 - 6}" fill="#93c5fd" font-family="monospace" font-size="${Math.max(11, width / 22)}" text-anchor="middle">MOCK ${label.toUpperCase()}</text>
  <text x="${width / 2}" y="${height / 2 + 14}" fill="#64748b" font-family="monospace" font-size="${Math.max(9, width / 30)}" text-anchor="middle">${thumbId ?? ""} · tick ${tick}</text>
  ${ppmBars}
</svg>`;

  return { status: 200, body: svg, contentType: "image/svg+xml" };
}

export function resolveMock(
  method: string,
  unitPath: string,
  requestBody?: unknown,
  ifNoneMatch?: string,
  searchParams: URLSearchParams = new URLSearchParams(),
  unitId?: string,
): MockResponse {
  const path = unitPath.replace(/^\/+|\/+$/g, "");

  if (method === "GET" || method === "HEAD") {
    if (/^[a-z_]+\/\d+\/thumbnails\/[^/]+$/.test(path)) {
      return buildThumbnailSvg(path, searchParams, unitId);
    }
    const routes = isBigUnit(unitId) ? bigGetRoutes(unitId!) : GET_ROUTES;
    const route = routes[path];
    if (route) {
      const body = route();
      const etag = computeEtag(body);
      if (ifNoneMatch && ifNoneMatch === etag) {
        return { status: 304, body: null, etag };
      }
      return { status: 200, body, etag };
    }
    return {
      status: 404,
      body: {
        title: "Not found",
        status: 404,
        message: `No mock data for GET /${path}. Add it in src/lib/intinor/mock/.`,
      },
    };
  }

  // Writes in mock mode: persist mixer settings so the applied program shows
  // up in later GETs and the program thumbnail; everything else echoes back.
  if (method === "PUT") {
    const settingsPut = path.match(
      /^(encoders|network_inputs|video_mixers)\/(\d+)\/settings$/,
    );
    if (settingsPut) {
      const kind = settingsPut[1] as SettingsKind;
      const index = Number(settingsPut[2]);
      putSettings(kind, index, requestBody, unitId);
      return { status: 200, body: currentSettings(kind, index, unitId) };
    }
    return { status: 200, body: requestBody ?? {} };
  }
  if (method === "POST") {
    return {
      status: 200,
      body: { title: "OK", status: 200, message: `Mock: accepted POST /${path}` },
    };
  }
  if (method === "DELETE") {
    return {
      status: 200,
      body: { title: "OK", status: 200, message: `Mock: accepted DELETE /${path}` },
    };
  }
  return {
    status: 405,
    body: { title: "Method not allowed", status: 405, message: `${method} not supported` },
  };
}
