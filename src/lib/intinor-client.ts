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
  AvailableFirmwaresResponse,
  Encoder,
  EncodersList,
  EncoderSettingsRequest,
  EncoderSettingsResponse,
  EncoderStatus,
  EncodingModesResponse,
  EncodingSettingsRequest,
  EncodingSettingsResponse,
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
  TestPictureSettingsRequest,
  TestPictureSettingsResponse,
  VideoInput,
  VideoInputSettings,
  VideoInputSettingsResponse,
  VideoInputsList,
  VideoInputStatus,
  VideoMixer,
  VideoMixersList,
  VideoMixerSettings,
  VideoMixerSettingsResponse,
  VideoMixerStatus,
} from "./intinor/types";

/**
 * Settings GETs ask for `_constraints` explicitly. It is part of the
 * *_settings_response schema anyway, but requesting it makes the dependency
 * obvious: the whole settings UI is driven by `_constraints.mutable`, so a
 * response without it must be treated as read-only rather than silently
 * editable.
 */
const CONSTRAINTS = "?include=_constraints";

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

  /** Raw binary PUT (image upload) — bypasses the JSON body/Content-Type of `request`. */
  async function putBinary(path: string, body: Blob): Promise<void> {
    const res = await fetch(`${base}/${path.replace(/^\/+/, "")}`, {
      method: "PUT",
      headers: { "Content-Type": body.type || "application/octet-stream" },
      body,
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
  }

  /** Raw text GET (e.g. the XML settings backup) — bypasses `request`'s `res.json()`. */
  async function getText(path: string): Promise<string> {
    const res = await fetch(`${base}/${path.replace(/^\/+/, "")}`);
    if (!res.ok) {
      let detail: Partial<StmError> = {};
      try {
        detail = (await res.json()) as Partial<StmError>;
      } catch {
        // non-JSON error body
      }
      throw new IntinorApiError(res.status, detail);
    }
    return res.text();
  }

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
      get<EncoderSettingsResponse>(`encoders/${index}/settings${CONSTRAINTS}`),
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
      get<NetworkInputSettingsResponse>(`network_inputs/${index}/settings${CONSTRAINTS}`),
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

    // -- video inputs ("Netvideo in": RTSP/HLS/NDI/RTMP pull, SRT caller/listener) --
    getVideoInputs: (include?: Include) =>
      get<VideoInputsList>(withInclude("video_inputs", include)),
    getVideoInput: (index: number, include?: Include) =>
      get<VideoInput>(withInclude(`video_inputs/${index}`, include)),
    getVideoInputSettings: (index: number) =>
      get<VideoInputSettingsResponse>(`video_inputs/${index}/settings${CONSTRAINTS}`),
    putVideoInputSettings: (
      index: number,
      body: VideoInputSettings & RequestMetadata,
    ) => put<VideoInputSettingsResponse>(`video_inputs/${index}/settings`, body),
    getVideoInputStatus: (index: number) =>
      get<VideoInputStatus>(`video_inputs/${index}/status`),
    videoInputThumbnailUrl: (index: number, id: string, opts: ThumbnailOptions = {}) =>
      `${base}/video_inputs/${index}/thumbnails/${id}` +
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
      get<VideoMixerSettingsResponse>(`video_mixers/${index}/settings${CONSTRAINTS}`),
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
    getEncodingSettings: () =>
      get<EncodingSettingsResponse>(`encoding/settings${CONSTRAINTS}`),
    putEncodingSettings: (body: EncodingSettingsRequest) =>
      put<EncodingSettingsResponse>("encoding/settings", body),
    getNetworkInterfaces: () => get<NetworkInterfacesList>("network_interfaces"),
    getProfiles: () => get<ProfilesList>("profiles"),

    // -- test picture (unit-wide fallback source) --------------------------
    getTestPictureSettings: () =>
      get<TestPictureSettingsResponse>(`test_picture/settings${CONSTRAINTS}`),
    putTestPictureSettings: (body: TestPictureSettingsRequest) =>
      put<TestPictureSettingsResponse>("test_picture/settings", body),
    /** No JSON schema on the unit for this one — it's a raw image PUT/GET. */
    putCustomBackground: (file: Blob) => putBinary("test_picture/custom_background", file),
    /**
     * `cacheBust` should come from caller-owned state (e.g. a counter bumped
     * after a successful upload), not `Date.now()`/`Math.random()` — this is
     * called during the initial render too, and a wall-clock value there
     * differs between the server-rendered HTML and client hydration passes.
     */
    customBackgroundUrl: (cacheBust?: number) =>
      `${base}/test_picture/custom_background` + (cacheBust ? query({ v: cacheBust }) : ""),

    // -- firmware / backup --------------------------------------------------
    getAvailableFirmwares: () =>
      get<AvailableFirmwaresResponse>("system/available_firmwares"),
    /** Raw XML backup — safe (GET), unlike restoring one, which stays permanently blocked. */
    getSystemConfigBackup: () => getText("system/config"),
  };
}

export type IntinorClient = ReturnType<typeof createIntinorClient>;

/** Default client for the single-unit setup (proxied at /api/unit). */
export const intinorClient = createIntinorClient();
