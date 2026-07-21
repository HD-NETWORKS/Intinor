/**
 * Route matcher for MOCK=1 mode: maps unit-relative API paths to mock
 * payloads. GETs return canned data; writes echo the request body back
 * (the GET→modify→PUT pattern succeeds without touching any hardware).
 */

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

export interface MockResponse {
  status: number;
  body: unknown;
  contentType?: string;
}

const THUMBNAIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#1a2233"/>
  <rect x="8" y="8" width="304" height="164" fill="none" stroke="#3b82f6" stroke-width="2" rx="4"/>
  <text x="160" y="86" fill="#93c5fd" font-family="monospace" font-size="16" text-anchor="middle">MOCK THUMBNAIL</text>
  <text x="160" y="110" fill="#64748b" font-family="monospace" font-size="12" text-anchor="middle">D01393</text>
</svg>`;

/** GET routes: exact path (after trimming slashes) → payload factory. */
const GET_ROUTES: Record<string, () => unknown> = {
  "": () => mockApiRoot,
  system: () => mockSystem,
  "system/status": () => mockSystemStatus,
  "system/messages": () => ({ messages: [] }),
  encoders: () => mockEncodersList,
  "encoders/0": () => ({
    ...mockEncoder,
    settings: mockEncoderSettings,
    status: mockEncoderStatus,
  }),
  "encoders/0/settings": () => mockEncoderSettings,
  "encoders/0/status": () => mockEncoderStatus,
  "encoders/0/thumbnails": () => ({
    thumbnails: [{ id: "video_source", href: "encoders/0/thumbnails/video_source" }],
  }),
  network_inputs: () => mockNetworkInputsList,
  "network_inputs/0": () => ({
    ...mockNetworkInput,
    settings: mockNetworkInputSettings,
    status: mockNetworkInputStatus,
  }),
  "network_inputs/0/settings": () => mockNetworkInputSettings,
  "network_inputs/0/status": () => mockNetworkInputStatus,
  "network_inputs/0/thumbnails": () => ({
    thumbnails: [{ id: "program_1", href: "network_inputs/0/thumbnails/program_1" }],
  }),
  video_mixers: () => mockVideoMixersList,
  "video_mixers/0": () => ({
    ...mockVideoMixer,
    settings: mockVideoMixerSettings,
    status: mockVideoMixerStatus,
  }),
  "video_mixers/0/settings": () => mockVideoMixerSettings,
  "video_mixers/0/status": () => mockVideoMixerStatus,
  network_interfaces: () => mockNetworkInterfaces,
  encoding: () => ({ encoding_modes: mockEncodingModes }),
  "encoding/encoding_modes": () => mockEncodingModes,
  multiviews: () => ({ multiviews: [] }),
  video_inputs: () => ({ video_inputs: [] }),
  video_outputs: () => ({ video_outputs: [] }),
  profiles: () => ({ profiles: [] }),
};

export function resolveMock(
  method: string,
  unitPath: string,
  requestBody?: unknown,
): MockResponse {
  const path = unitPath.replace(/^\/+|\/+$/g, "");

  if (method === "GET" || method === "HEAD") {
    if (/^[a-z_]+\/\d+\/thumbnails\/[^/]+$/.test(path)) {
      return { status: 200, body: THUMBNAIL_SVG, contentType: "image/svg+xml" };
    }
    const route = GET_ROUTES[path];
    if (route) {
      return { status: 200, body: route() };
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
