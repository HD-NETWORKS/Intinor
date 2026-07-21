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
  mockEncoderSettings,
  mockEncodersList,
  mockEncoderStatus,
  mockEncodingModes,
  mockNetworkInput,
  mockNetworkInputSettings,
  mockNetworkInputsList,
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
    settings: mockEncoderSettings,
    status: liveEncoderStatus(),
    thumbnails: {
      thumbnails: [{ id: "video_source", href: "encoders/0/thumbnails/video_source" }],
    },
  }),
  "encoders/0/settings": () => mockEncoderSettings,
  "encoders/0/status": () => liveEncoderStatus(),
  "encoders/0/thumbnails": () => ({
    thumbnails: [{ id: "video_source", href: "encoders/0/thumbnails/video_source" }],
  }),
  network_inputs: () => mockNetworkInputsList,
  "network_inputs/0": () => ({
    ...mockNetworkInput,
    settings: mockNetworkInputSettings,
    status: liveNetworkInputStatus(),
    thumbnails: {
      thumbnails: [{ id: "program_1", href: "network_inputs/0/thumbnails/program_1" }],
    },
  }),
  "network_inputs/0/settings": () => mockNetworkInputSettings,
  "network_inputs/0/status": () => liveNetworkInputStatus(),
  "network_inputs/0/thumbnails": () => ({
    thumbnails: [{ id: "program_1", href: "network_inputs/0/thumbnails/program_1" }],
  }),
  video_mixers: () => mockVideoMixersList,
  "video_mixers/0": () => ({
    ...mockVideoMixer,
    settings: mockVideoMixerSettings,
    status: mockVideoMixerStatus,
    thumbnails: {
      thumbnails: [{ id: "program", href: "video_mixers/0/thumbnails/program" }],
    },
  }),
  "video_mixers/0/settings": () => mockVideoMixerSettings,
  "video_mixers/0/status": () => mockVideoMixerStatus,
  "video_mixers/0/thumbnails": () => ({
    thumbnails: [{ id: "program", href: "video_mixers/0/thumbnails/program" }],
  }),
  network_interfaces: () => liveNetworkInterfaces(),
  encoding: () => ({ encoding_modes: mockEncodingModes }),
  "encoding/encoding_modes": () => mockEncodingModes,
  multiviews: () => ({ multiviews: [] }),
  video_inputs: () => ({ video_inputs: [] }),
  video_outputs: () => ({ video_outputs: [] }),
  profiles: () => ({ profiles: [] }),
};

function computeEtag(body: unknown): string {
  const json = JSON.stringify(body);
  return `"${createHash("sha1").update(json).digest("hex").slice(0, 16)}"`;
}

// ---------------------------------------------------------------------------
// Thumbnails — SVG placeholder, resource-labelled, with an optional PPM
// (audio peak-meter) overlay so toggling the real option visibly does
// something even against mock data.
// ---------------------------------------------------------------------------

function buildThumbnailSvg(path: string, searchParams: URLSearchParams): MockResponse {
  const [resourceType, indexStr, , thumbId] = path.split("/");
  const width = Number(searchParams.get("width")) || 320;
  const height = Number(searchParams.get("height")) || Math.round((width * 9) / 16);
  const ppm = searchParams.get("ppm") === "true" || searchParams.get("ppm") === "1";
  const tick = currentTick();
  const label = `${resourceType.replace(/_/g, " ")} #${indexStr}`;

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
): MockResponse {
  const path = unitPath.replace(/^\/+|\/+$/g, "");

  if (method === "GET" || method === "HEAD") {
    if (/^[a-z_]+\/\d+\/thumbnails\/[^/]+$/.test(path)) {
      return buildThumbnailSvg(path, searchParams);
    }
    const route = GET_ROUTES[path];
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

  // Writes in mock mode: echo the settings back as the unit would.
  if (method === "PUT") {
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
