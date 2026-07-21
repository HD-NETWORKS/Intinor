/**
 * Typed client for the Intinor unit, for use from browser code (and client
 * components). Every call goes through our own /api/unit proxy — never
 * directly to the unit — so no credentials ever exist client-side.
 *
 * Multi-unit ready: `createIntinorClient("/api/unit")` today; when a second
 * unit arrives, mount more proxy bases (e.g. /api/units/D01393) and create
 * one client per unit. Nothing here assumes index 0 or a single pipe.
 *
 * Write helpers (put… / restart…) exist for later phases; the proxy rejects
 * them with 403 until writes are explicitly enabled (see server/guard.ts).
 */

import type {
  ApiRootInfo,
  Encoder,
  EncodersList,
  EncoderSettingsRequest,
  EncoderSettingsResponse,
  EncoderStatus,
  EncodingModesResponse,
  NetworkInput,
  NetworkInputSettings,
  NetworkInputSettingsResponse,
  NetworkInputsList,
  NetworkInputStatus,
  NetworkInterfacesList,
  ProfilesList,
  RequestMetadata,
  StmError,
  SystemInformation,
  SystemStatus,
  VideoMixer,
  VideoMixersList,
  VideoMixerSettings,
  VideoMixerSettingsResponse,
  VideoMixerStatus,
} from "./intinor/types";

/** Default proxy base for the single-unit setup. Shared with usePolledResource. */
export const UNIT_PROXY_BASE = "/api/unit";

export class IntinorApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: Partial<StmError>,
    message?: string,
  ) {
    super(message ?? detail.message ?? `Intinor API error (HTTP ${status})`);
    this.name = "IntinorApiError";
  }
}

/** Subresources bundled into a GET via the API's `include` parameter. */
export type Include = string[];

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  jpegQuality?: number;
  /** Overlay a peak-program (audio level) meter */
  ppm?: boolean;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export function createIntinorClient(base: string = UNIT_PROXY_BASE) {
  async function request<T>(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<T> {
    const res = await fetch(`${base}/${path.replace(/^\/+/, "")}`, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      let detail: Partial<StmError> = {};
      try {
        detail = (await res.json()) as Partial<StmError>;
      } catch {
        // non-JSON error body
      }
      throw new IntinorApiError(res.status, detail);
    }
    return (await res.json()) as T;
  }

  const get = <T>(path: string): Promise<T> => request<T>(path);
  const put = <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: "PUT", body });
  const post = <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: "POST", body });

  const withInclude = (path: string, include?: Include): string =>
    include?.length ? `${path}${query({ include: include.join(",") })}` : path;

  return {
    // -- root / system ------------------------------------------------------
    getApiRoot: () => get<ApiRootInfo>(""),
    getSystem: () => get<SystemInformation>("system"),
    getSystemStatus: () => get<SystemStatus>("system/status"),

    // -- encoders -----------------------------------------------------------
    getEncoders: (include?: Include) =>
      get<EncodersList>(withInclude("encoders", include)),
    getEncoder: (index: number, include?: Include) =>
      get<Encoder>(withInclude(`encoders/${index}`, include)),
    getEncoderSettings: (index: number) =>
      get<EncoderSettingsResponse>(`encoders/${index}/settings`),
    putEncoderSettings: (index: number, body: EncoderSettingsRequest) =>
      put<EncoderSettingsResponse>(`encoders/${index}/settings`, body),
    getEncoderStatus: (index: number) =>
      get<EncoderStatus>(`encoders/${index}/status`),
    restartEncoder: (index: number) =>
      post<StmError>(`encoders/${index}/actions/restart`),
    encoderThumbnailUrl: (index: number, id: string, opts: ThumbnailOptions = {}) =>
      `${base}/encoders/${index}/thumbnails/${id}` +
      query({
        width: opts.width,
        height: opts.height,
        jpeg_quality: opts.jpegQuality,
        ppm: opts.ppm,
      }),

    // -- network inputs (ingest) -------------------------------------------
    getNetworkInputs: (include?: Include) =>
      get<NetworkInputsList>(withInclude("network_inputs", include)),
    getNetworkInput: (index: number, include?: Include) =>
      get<NetworkInput>(withInclude(`network_inputs/${index}`, include)),
    getNetworkInputSettings: (index: number) =>
      get<NetworkInputSettingsResponse>(`network_inputs/${index}/settings`),
    putNetworkInputSettings: (
      index: number,
      body: NetworkInputSettings & RequestMetadata,
    ) => put<NetworkInputSettingsResponse>(`network_inputs/${index}/settings`, body),
    getNetworkInputStatus: (index: number) =>
      get<NetworkInputStatus>(`network_inputs/${index}/status`),
    restartNetworkInput: (index: number) =>
      post<StmError>(`network_inputs/${index}/actions/restart`),
    networkInputThumbnailUrl: (index: number, id: string, opts: ThumbnailOptions = {}) =>
      `${base}/network_inputs/${index}/thumbnails/${id}` +
      query({
        width: opts.width,
        height: opts.height,
        jpeg_quality: opts.jpegQuality,
        ppm: opts.ppm,
      }),

    // -- video mixers -------------------------------------------------------
    getVideoMixers: (include?: Include) =>
      get<VideoMixersList>(withInclude("video_mixers", include)),
    getVideoMixer: (index: number, include?: Include) =>
      get<VideoMixer>(withInclude(`video_mixers/${index}`, include)),
    getVideoMixerSettings: (index: number) =>
      get<VideoMixerSettingsResponse>(`video_mixers/${index}/settings`),
    putVideoMixerSettings: (
      index: number,
      body: VideoMixerSettings & RequestMetadata,
    ) => put<VideoMixerSettingsResponse>(`video_mixers/${index}/settings`, body),
    getVideoMixerStatus: (index: number) =>
      get<VideoMixerStatus>(`video_mixers/${index}/status`),
    videoMixerThumbnailUrl: (index: number, id: string, opts: ThumbnailOptions = {}) =>
      `${base}/video_mixers/${index}/thumbnails/${id}` +
      query({
        width: opts.width,
        height: opts.height,
        jpeg_quality: opts.jpegQuality,
        ppm: opts.ppm,
      }),

    // -- encoding modes / interfaces / profiles ----------------------------
    getEncodingModes: () => get<EncodingModesResponse>("encoding/encoding_modes"),
    getNetworkInterfaces: () => get<NetworkInterfacesList>("network_interfaces"),
    getProfiles: () => get<ProfilesList>("profiles"),
  };
}

export type IntinorClient = ReturnType<typeof createIntinorClient>;

/** Default client for the single-unit setup (proxied at /api/unit). */
export const intinorClient = createIntinorClient();
