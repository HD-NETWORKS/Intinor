/**
 * TypeScript types for the Intinor DirektAPIServer REST API (v1.18.0).
 *
 * Hand-derived from the unit's swagger.json (see docs/ in this repo:
 * 01-intinor-api-reference.md + 02-intinor-api-definitions-full.md).
 * Field names and required/optional markers follow the spec exactly.
 *
 * Forward-compatibility rule from the API docs: clients MUST ignore unknown
 * fields, so every response type here is open-ended (consumers should not
 * assume these are exhaustive at runtime).
 */

// ---------------------------------------------------------------------------
// Common metadata (present on most responses)
// ---------------------------------------------------------------------------

export interface Link {
  method: string;
  href: string;
  rel: string;
}

export type MessageSeverity = "notice" | "warning" | "error";

export interface ApiMessage {
  id?: string;
  fields?: string[];
  severity: MessageSeverity;
  message: string;
  links?: Link[];
}

/** Echo `_version` back on PUT if present; never send back `_constraints`, `_messages`, `_links`. */
export interface ResponseMetadata {
  _version?: string;
  _messages?: ApiMessage[];
  _links?: Link[];
}

export interface RequestMetadata {
  _version?: string;
}

export interface DescriptionValue {
  value?: string;
  description: string;
}

export interface DescriptionIntegerValue {
  value?: number;
  description: string;
}

export interface DescriptionDocumentationValue extends DescriptionValue {
  documentation: string;
}

export interface IntegerMinMax {
  min: number;
  max: number;
}

export interface NumberMinMax {
  min: number;
  max: number;
}

/**
 * Field-level write access for the current user, dot-notation paths
 * (e.g. "destinations[].active"). `[]` = read-only, `["*"]` = all writable.
 */
export type MutableList = string[];

// ---------------------------------------------------------------------------
// Common pipe shapes (shared by encoders / inputs / outputs / mixers / multiviews)
// ---------------------------------------------------------------------------

export interface Connector {
  name: string;
}

export interface VideoFormatConstraint {
  framerate?: number;
  resolution?: string;
  description: string;
  value?: string;
}

export interface CommonPipeConstraints {
  connectors: Connector[];
  formats?: VideoFormatConstraint[];
}

export interface CommonPipeInfo {
  _links?: Link[];
  name: string;
  index: number;
  description: string;
  active: boolean;
  href: string;
  type: string;
}

export interface CommonPipeSettings {
  description: string;
  active: boolean;
}

export interface CommonPipeSettingsConstraints {
  capabilities: { deactivatable: boolean };
  mutable?: MutableList;
}

export interface CommonPipeStatus {
  messages: ApiMessage[];
  active: boolean;
  description: string;
  _links?: Link[];
}

export interface PipeThumbnail {
  href?: string;
  _links?: Link[];
  id: string;
}

export interface PipeThumbnails {
  thumbnails: PipeThumbnail[];
  _links?: Link[];
}

// ---------------------------------------------------------------------------
// Audio / video status primitives
// ---------------------------------------------------------------------------

export interface AudioFormat {
  sample_rate: number;
  bit_depth: number;
  channels: number;
}

export interface CodecStatus {
  name: string;
  configured_performance_mode?: string;
  adaptive_bitrate_max?: number;
  level?: string;
  adaptive_bitrate_min?: number;
  default_performance_mode?: string;
  profile?: string;
  bitrate?: number;
  bitrate_buffer?: number;
  performance_mode?: string;
  adaptive_bitrate: boolean;
}

export interface AudioStatus {
  description?: string;
  format: AudioFormat;
  language?: string;
  codec?: CodecStatus;
}

export interface VideoFormat {
  display_aspect: string;
  pixel_aspect: string;
  height: number;
  forced_aspect: boolean;
  framerate: number;
  interlaced: boolean;
  width: number;
  top_field_first: boolean;
  chroma_subsampling: string;
}

export interface VideoStatus {
  codec?: CodecStatus;
  format: VideoFormat;
}

export interface VideoOutStatus {
  audio: AudioStatus[];
  video?: VideoStatus;
}

// ---------------------------------------------------------------------------
// Video source (how pipes reference each other, e.g. encoder <- network input)
// ---------------------------------------------------------------------------

export interface VideoSourceSourceSettings {
  /** URI of a video_input / network_input / video_mixer resource */
  source: string;
  program_id?: number;
}

export interface VideoSourceSettings extends VideoSourceSourceSettings {
  fallback: string;
}

export interface VideoSourceConstraint {
  name: string;
  programs?: DescriptionValue[];
  value?: string;
  description?: string;
  multiprogram?: boolean;
}

export interface VideoSourceSourceSettingsConstraints {
  source: VideoSourceConstraint[];
}

export interface VideoSourceSettingsConstraints
  extends VideoSourceSourceSettingsConstraints {
  fallback: DescriptionValue[];
}

export interface VideoSourceStatus {
  available: boolean;
  fallback?: boolean;
  fallback_type?: string;
  program_id?: number;
  source: string;
  video?: VideoStatus;
  thumbnail?: string;
  fallback_description?: string;
  audio?: AudioStatus[];
}

// ---------------------------------------------------------------------------
// Encoding modes / encoding settings
// ---------------------------------------------------------------------------

export interface EncodingModeVideo {
  latency_quality_mode?: string;
  gop: number;
  scene_change_detection?: boolean;
  performance_mode?: string;
  codec: string;
  chroma: string;
  bitrate_buffer?: number;
  format: string;
  bitrate: number;
  level: string;
  profile: string;
}

export interface EncodingModeAudio {
  downmix?: string;
  bitrate: number;
  tracks: number;
  samplerate?: number;
  codec: string;
}

export interface EncodingMode {
  video: EncodingModeVideo;
  audio: EncodingModeAudio;
  group?: string;
  group_description?: string;
  total_bitrate?: number;
  href?: string;
  description: string;
  id: string;
}

export interface EncodingModesResponse extends ResponseMetadata {
  encoding_modes: EncodingMode[];
}

// ---------------------------------------------------------------------------
// Global encoding settings (`GET/PUT /encoding/settings`) — built-in-mode
// audio defaults, the unit-wide default SD aspect ratio, and the editable
// list of custom encoding modes. Distinct from `encoding/encoding_modes`
// (the combined built-in + custom read-only list used to populate a pipe's
// `encoding_mode` dropdown, via EncodingModesResponse above) — this is where
// custom modes are actually authored.
// ---------------------------------------------------------------------------

export interface BuiltinEncodingModesSettings {
  audio: { downmix?: string; tracks: number };
}

export interface BuiltinEncodingModesConstraints {
  audio: { tracks: IntegerMinMax; downmix: DescriptionValue[] };
}

export interface EncodingSettingsVideoInput {
  sd_aspect_ratio?: string;
}

export interface EncodingSettingsVideoInputConstraints {
  sd_aspect_ratio: DescriptionValue[];
}

export interface CustomEncodingModesConstraintsAudioCodec {
  value: string;
  description: string;
  bitrate: IntegerMinMax;
  tracks: IntegerMinMax;
  samplerate?: DescriptionIntegerValue[];
  downmix?: DescriptionValue[];
}

export interface CustomEncodingModesConstraintsLatencyQualityMode {
  value: string;
  description: string;
  coded_picture_buffer?: { seconds?: number; frames?: number };
  encoding_latency?: { frames?: number; seconds?: number };
}

export interface CustomEncodingModesConstraintsVideoCodec {
  value: string;
  description: string;
  capabilities?: { scene_change_detection?: boolean };
  chroma: DescriptionValue[];
  format?: VideoFormatConstraint[];
  gop: IntegerMinMax;
  bitrate: IntegerMinMax;
  bitrate_buffer?: Array<{ value?: number; description: string }>;
  level: DescriptionValue[];
  profile: DescriptionValue[];
  adaptive_bitrate?: { bitrate_lower_factor?: number; bitrate_upper_factor?: number };
  latency_quality_mode?: CustomEncodingModesConstraintsLatencyQualityMode[];
}

export interface CustomEncodingModesConstraints {
  audio_codecs: CustomEncodingModesConstraintsAudioCodec[];
  video_codecs: CustomEncodingModesConstraintsVideoCodec[];
}

export interface CommonEncodingSettings {
  builtin_encoding_modes: BuiltinEncodingModesSettings;
  custom_encoding_modes: EncodingMode[];
  video_input: EncodingSettingsVideoInput;
}

export interface EncodingSettings extends CommonEncodingSettings {
  _version?: string;
}

export interface EncodingSettingsConstraints {
  mutable: MutableList;
  builtin_encoding_modes: BuiltinEncodingModesConstraints;
  custom_encoding_modes: CustomEncodingModesConstraints;
  video_input: EncodingSettingsVideoInputConstraints;
  [key: string]: unknown;
}

export type EncodingSettingsRequest = EncodingSettings & RequestMetadata;

export type EncodingSettingsResponse = EncodingSettings &
  ResponseMetadata & { _constraints?: EncodingSettingsConstraints };

export interface PipeEncodingSettings {
  /** id of an encoding_mode */
  encoding_mode: string;
  adaptive_bitrate?: boolean;
}

export interface PipeEncodingSettingsConstraints {
  capabilities: { adaptive_bitrate: boolean };
  encoding_mode: Array<{
    group: string;
    total_bitrate: number;
    id: string;
    value?: string;
    group_description: string;
    description: string;
  }>;
  adaptive_bitrate?: {
    audio_bitrate_upper_factor: number;
    video_bitrate_upper_factor: number;
    audio_bitrate_lower_factor: number;
    video_bitrate_lower_factor: number;
  };
}

export interface EncodingStatus {
  sidedata?: { scte35?: { injected_packets?: number } };
  audio: AudioStatus[];
  video?: VideoStatus;
  total_bitrate: number;
}

// ---------------------------------------------------------------------------
// Recording (per-pipe)
// ---------------------------------------------------------------------------

export interface PipeRecordingFormatSettings {
  max_file_size: number;
  path: string;
  active: boolean;
}

export interface PipeRecordingSettings {
  mpegts?: PipeRecordingFormatSettings;
  flv?: PipeRecordingFormatSettings;
}

export interface RecordingStatusCommon {
  status: string;
  messages: ApiMessage[];
  duration: number;
}

export interface RecordingStatus {
  flv?: RecordingStatusCommon;
  mpegts?: RecordingStatusCommon;
}

// ---------------------------------------------------------------------------
// Destinations (push output: SRT / RIST / UDP / RTMP)
// ---------------------------------------------------------------------------

export interface DestinationFailover {
  port: number;
  description: string;
  additional?: DestinationsSettingsBasicAdditional[];
  active: boolean;
  address: string;
}

export interface DestinationsSettingsBasicAdditional {
  address: string;
  active: boolean;
  description: string;
  port: number;
}

export interface DestinationsSettingsBasic {
  protocol: string;
  address: string;
  port: number;
  active: boolean;
  description: string;
  id: string;
  network_interface?: string;
  extra_delay?: number;
  srt?: {
    latency: number;
    rendezvous?: boolean;
    password: string;
    stream_id: string;
    key_length: number;
  };
  rist?: {
    latency: number;
    password?: string;
    key_length?: number;
    profile: string;
  };
  failover?: DestinationFailover[];
  additional?: DestinationsSettingsBasicAdditional[];
}

export interface DestinationsSettingsRtmp {
  description: string;
  id: string;
  user?: string;
  active: boolean;
  backup?: { password?: string; url: string; stream: string; user?: string };
  password?: string;
  audio_track?: number;
  url: string;
  stream: string;
  extra_delay?: number;
}

export interface DestinationsSrtOnRequest {
  adapter?: string;
  key_length?: number;
  latency?: number;
  local_port: number;
  password?: string;
  extra_delay?: number;
  active: boolean;
  rtp_over_srt?: boolean;
}

export interface DestinationsTcpOnRequest {
  active: boolean;
  extra_delay?: number;
  local_port: number;
}

export interface DestinationsSettingsAdvanced {
  udp_bonding_delay?: number;
  brt?: {
    redundancy_profile: string;
    buffer_profile: string;
    selective_redundancy_profile: string;
    custom_latency: number;
    custom_end_to_end_delay: number;
    latency_profile: string;
    custom_redundancy: number;
  };
  extra_delay?: number;
  fec_layout?: { d: number; l: number };
  udp_smoothing_buffer?: number;
}

export interface DestinationsSettings {
  rtmp?: DestinationsSettingsRtmp[];
  basic: DestinationsSettingsBasic[];
  srt_on_request?: DestinationsSrtOnRequest;
  advanced?: DestinationsSettingsAdvanced;
  tcp_on_request?: DestinationsTcpOnRequest;
}

export interface DestinationStatusCommon {
  messages: ApiMessage[];
  bitrate: number;
}

export interface DestinationStatusBondingPath {
  packet_late_history?: number;
  estimated_capacity: number;
  network_interface: string;
  packet_late?: number;
  redundancy_bitrate?: number;
  messages: ApiMessage[];
  estimate_is_max: boolean;
  packet_loss_history?: number;
  latency?: number;
  bitrate: number;
  destination?: string;
  viable?: boolean;
  latency_history?: number;
  packet_loss?: number;
}

export interface DestinationStatusBonding {
  paths: DestinationStatusBondingPath[];
  destinations?: string[];
  estimated_capacity: number;
  estimate_is_max: boolean;
  failover_active?: boolean;
  bitrate: number;
  destination?: string;
}

export interface DestinationStatusBasic extends DestinationStatusCommon {
  id: string;
  bonding?: DestinationStatusBonding;
  packet_loss?: number;
  fec?: { bitrate_overhead: number; packet_loss?: number };
  udp_smoothing_buffer?: number;
}

export interface DestinationStatusRtmp extends DestinationStatusCommon {
  id: string;
}

export interface DestinationStatusSrtClient extends DestinationStatusCommon {
  packet_loss?: number;
  address: string;
}

export interface DestinationStatusTcpClient extends DestinationStatusCommon {
  address: string;
}

export interface DestinationsStatus {
  tcp_on_request?: { clients: DestinationStatusTcpClient[] };
  rtmp?: DestinationStatusRtmp[];
  basic: DestinationStatusBasic[];
  srt_on_request?: { clients: DestinationStatusSrtClient[] };
}

export interface DestinationsSettingsConstraints {
  capabilities: { encryption: boolean };
  protocol: Array<{ value: string; type: string; description: string }>;
  basic: {
    rist?: {
      profile?: Array<{ name: string; value: string }>;
      key_length: Array<{ name: string; value: number }>;
    };
    extra_delay?: IntegerMinMax;
    network_interface: DescriptionValue[];
  };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Access control (stream access keys)
// ---------------------------------------------------------------------------

export interface AccessControlSettings {
  serial?: string;
  ip?: string;
  description: string;
  key?: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Muxing (transport stream / PSI-SI) — per-encoder MPEG-TS packaging.
// Not present in docs/02-intinor-api-definitions-full.md (that dump predates
// this UI on the real unit); field names below are inferred from the stock
// console's "Muxing" tab and unverified against the live API. Since every
// field is gated by `_constraints.mutable` like the rest of the form, a wrong
// field name just means the section won't render (or won't be editable) on a
// real unit rather than sending a bad PUT — safe to ship ahead of confirmation.
// ---------------------------------------------------------------------------

export interface MuxingAudioStreamSettings {
  pid?: number;
  component_tag?: string;
}

export interface MuxingSettings {
  mode: string;
  transport_stream_id: number;
  program_number: number;
  mp2_audio_stream_type: string;
  video: { pid: number; component_tag?: string };
  audio: MuxingAudioStreamSettings[];
  pcr: { repetition_interval: number };
  pat: { pid: number };
  pmt: { pid: number; repetition_interval: number };
  dvb: {
    nit: { network_name: string; network_id: number; repetition_interval: number };
    eit: { repetition_interval: number };
    tdt: { repetition_interval: number };
    sdt: {
      service_name: string;
      service_provider_name: string;
      repetition_interval: number;
    };
  };
  klv_metadata: { active: boolean };
  authentication_metadata: { active: boolean };
}

export interface MuxingSettingsConstraints {
  mode?: DescriptionValue[];
  mp2_audio_stream_type?: DescriptionValue[];
  transport_stream_id?: IntegerMinMax;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

export interface EncoderSettings extends CommonPipeSettings {
  recording: PipeRecordingSettings;
  encoding: PipeEncodingSettings;
  video_source: VideoSourceSettings;
  access_control?: AccessControlSettings[];
  destinations: DestinationsSettings;
  /** Not on every unit/firmware — see MuxingSettings note above. */
  muxing?: MuxingSettings;
}

export interface EncoderSettingsConstraints
  extends CommonPipeSettingsConstraints {
  encoding: PipeEncodingSettingsConstraints;
  destinations: DestinationsSettingsConstraints;
  mutable: MutableList;
  video_source: VideoSourceSettingsConstraints;
  muxing?: MuxingSettingsConstraints;
  [key: string]: unknown;
}

export type EncoderSettingsRequest = EncoderSettings & RequestMetadata;

export type EncoderSettingsResponse = EncoderSettings &
  ResponseMetadata & { _constraints?: EncoderSettingsConstraints };

export interface EncoderStatus extends CommonPipeStatus {
  recording: RecordingStatus;
  video_source: VideoSourceStatus;
  encoding: EncodingStatus;
  destinations: DestinationsStatus;
}

export interface Encoder extends CommonPipeInfo {
  _constraints?: CommonPipeConstraints;
  settings?: EncoderSettingsResponse;
  thumbnails?: PipeThumbnails;
  status?: EncoderStatus;
}

export interface EncodersList {
  encoders: Encoder[];
  _links?: Link[];
}

// ---------------------------------------------------------------------------
// Network input (SRT/RTMP/RTP/HLS ingest)
// ---------------------------------------------------------------------------

export interface NetworkSourcesSrtCaller {
  adapter?: string;
  stream_id?: string;
  password?: string;
  latency?: number;
  active: boolean;
  address: string;
  port: number;
  rendezvous?: boolean;
}

export interface NetworkSourcesUdpUnicast {
  network_interface: string;
  active: boolean;
  srt?: { latency: number; password: string };
  rist?: { latency: number; password: string };
  port: number;
}

export interface NetworkSourcesUdpMulticast {
  port: number;
  network_interface?: string;
  address: string;
  active: boolean;
}

export interface NetworkSourcesTcpReceive {
  port: number;
  active: boolean;
}

export interface NetworkSourcesTcpRequest {
  port: number;
  active: boolean;
  address: string;
}

export interface NetworkSourcesRtmp {
  active: boolean;
  url: string;
  stream: string;
}

export interface NetworkSourcesAdvanced {
  tcp_receive_buffer: number;
  decoder_buffer?: number;
}

export interface NetworkSourcesSettings {
  rtmp?: NetworkSourcesRtmp;
  tcp_receive: NetworkSourcesTcpReceive;
  encryption?: boolean;
  tcp_request: NetworkSourcesTcpRequest;
  advanced: NetworkSourcesAdvanced;
  srt_caller?: NetworkSourcesSrtCaller;
  udp_unicast: NetworkSourcesUdpUnicast;
  udp_multicast: NetworkSourcesUdpMulticast;
}

export interface NetworkInputSettings extends CommonPipeSettings {
  network_sources: NetworkSourcesSettings;
  recording?: PipeRecordingSettings;
  access_control: AccessControlSettings[];
  destinations?: DestinationsSettings;
}

export type NetworkInputSettingsResponse = NetworkInputSettings &
  ResponseMetadata & { _constraints?: { mutable: MutableList; [key: string]: unknown } };

export interface NetworkSourceStatusProgram {
  end_to_end_delay?: { delay?: number; target?: number };
  number?: number;
  audio: AudioStatus[];
  messages: ApiMessage[];
  thumbnail?: string;
  video?: VideoStatus;
  id: string;
  name?: string;
  buffers?: { decoder: number; target: number; reception: number };
}

export interface NetworkSourceStatus {
  source_type?: string;
  bitrate?: number;
  encrypted: boolean;
  rtp?: { buffer?: number };
  packet_loss?: number;
  fec?: { buffer: number; packet_loss: number };
  rist?: { profile?: number };
  programs: NetworkSourceStatusProgram[];
  sender?: { serial: string; verified: boolean };
  bonding?: {
    protocol?: string;
    paths: Array<{
      receive_differential?: number;
      messages: ApiMessage[];
      packet_loss?: number;
      receive_time?: number;
      packet_late?: number;
      address: string;
      network_interface?: string;
      id?: string;
    }>;
    buffer: number;
  };
  srt?: Record<string, never>;
  address?: string;
}

export interface NetworkInputStatus extends CommonPipeStatus {
  recording?: RecordingStatus;
  network_source: NetworkSourceStatus;
  destinations: DestinationsStatus;
}

export interface NetworkInput extends CommonPipeInfo {
  _constraints?: CommonPipeConstraints;
  status?: NetworkInputStatus;
  settings?: NetworkInputSettingsResponse;
  thumbnails?: PipeThumbnails;
}

export interface NetworkInputsList {
  network_inputs: NetworkInput[];
  _links?: Link[];
}

// ---------------------------------------------------------------------------
// Video input ("Netvideo in" on the stock console) — a second, distinct
// ingest resource alongside network_input ("IP stream in"): pull-based
// sources (RTSP/HLS/NDI/RTMP) in addition to the SRT/RTMP push-or-listen
// shapes network_input offers. Only one `netvideo_source.*` sub-object is
// active at a time, selected by `netvideo_source.type`.
// ---------------------------------------------------------------------------

export interface NetvideoSourceSettings {
  /** Selects which sibling object below is active. */
  type: string;
  rtsp_pull?: { url: string };
  hls?: { url?: string };
  ndi?: { audio_gain?: number; source?: string };
  srt_caller?: {
    address: string;
    port: number;
    latency?: number;
    stream_id?: string;
    password?: string;
    adapter?: string;
    rendezvous?: boolean;
  };
  srt_listener?: {
    address?: string;
    port: number;
    latency?: number;
    password?: string;
    adapter?: string;
    rendezvous?: boolean;
  };
  rtmp_receive?: { stream: string };
  rtmp_pull?: { url: string; stream: string };
  audio_select?: Array<{ value: string; target: string }>;
}

export interface NetvideoSourceSettingsConstraints {
  type: Array<{ value: string; description: string }>;
  advanced?: { source_clock_reconstruction?: DescriptionIntegerValue[] };
  rtmp_receive?: { rtmp_url_example: string };
  audio_select?: Array<{ target: string; description: string }>;
  network_interface?: DescriptionValue[];
  [key: string]: unknown;
}

export interface NetvideoSourceStatusHlsProgram {
  bitrate?: number;
  audio?: Array<{ channels?: number; description?: string; language?: string }>;
  video?: { width?: number; height?: number; framerate?: number };
}

export interface NetvideoSourceStatus {
  rtmp_receive?: { address?: string; bitrate?: number };
  hls?: { detected_programs: NetvideoSourceStatusHlsProgram[]; selected_program?: number };
  srt?: {
    latency?: number;
    bitrate?: number;
    address?: string;
    packet_loss?: { before?: number; after?: number };
  };
}

export interface VideoInStatus {
  audio: AudioStatus[];
  video?: VideoStatus;
  available: boolean;
}

export interface VideoInputSettings extends CommonPipeSettings {
  netvideo_source: NetvideoSourceSettings;
}

export interface VideoInputSettingsConstraints
  extends CommonPipeSettingsConstraints {
  netvideo_source: NetvideoSourceSettingsConstraints;
  mutable: MutableList;
  [key: string]: unknown;
}

export type VideoInputSettingsRequest = VideoInputSettings & RequestMetadata;

export type VideoInputSettingsResponse = VideoInputSettings &
  ResponseMetadata & { _constraints?: VideoInputSettingsConstraints };

export interface VideoInputStatus extends CommonPipeStatus {
  netvideo_source: NetvideoSourceStatus;
  video_in?: VideoInStatus;
}

export interface VideoInput extends CommonPipeInfo {
  _constraints?: CommonPipeConstraints;
  status?: VideoInputStatus;
  settings?: VideoInputSettingsResponse;
  thumbnails?: PipeThumbnails;
}

export interface VideoInputsList {
  video_inputs: VideoInput[];
  _links?: Link[];
}

// ---------------------------------------------------------------------------
// Video mixer (custom layered compositing — quad grid etc.)
// ---------------------------------------------------------------------------

export interface VideoMixerLayerLayoutSettings {
  /** 0.0 = left edge, 1.0 = right edge */
  x: number;
  /** 0.0 = top edge, 1.0 = bottom edge */
  y: number;
  /** 0.1 = 10% size … 1.0 = full size */
  zoom: number;
}

export interface VideoMixerLayerSettings {
  layout: VideoMixerLayerLayoutSettings;
  input: VideoSourceSourceSettings;
}

export interface VideoMixerOverlaySettings {
  input: VideoSourceSourceSettings;
}

export interface VideoMixerOutputSettings {
  overlay?: VideoMixerOverlaySettings;
  background?: string;
  /** Ordered back-to-front */
  layers: VideoMixerLayerSettings[];
}

export interface VideoMixerOutSettings {
  /** Deprecated PIP shortcut */
  pip?: { zoom: number };
  /** "{width}x{height}{i|p}/{framerate}" e.g. "1920x1080p/25" */
  format?: string;
  sd_aspect_ratio: string;
}

export interface VideoMixerAudioSettings {
  muted: boolean;
  input: VideoSourceSourceSettings;
}

export interface VideoMixerLayoutProfileLayerSettings {
  layout: VideoMixerLayerLayoutSettings;
}

export interface VideoMixerLayoutProfilesSettings {
  layers: VideoMixerLayoutProfileLayerSettings[];
}

export interface VideoMixerSourceProfileSettings {
  input?: VideoSourceSourceSettings;
}

export interface VideoMixerSettings extends CommonPipeSettings {
  preview?: VideoMixerOutputSettings;
  layout_profiles?: VideoMixerLayoutProfilesSettings[];
  source_profiles?: VideoMixerSourceProfileSettings[];
  /** Deprecated in favour of program/preview layers */
  video_sources: VideoSourceSourceSettings[];
  video_out: VideoMixerOutSettings;
  audio?: VideoMixerAudioSettings;
  program?: VideoMixerOutputSettings;
}

export interface VideoMixerLayerLayoutConstraints {
  zoom: NumberMinMax;
  x: NumberMinMax;
  y: NumberMinMax;
}

export interface VideoMixerOutputSettingsConstraints {
  layers: {
    array_size?: IntegerMinMax;
    layout?: VideoMixerLayerLayoutConstraints;
    input?: VideoSourceSourceSettingsConstraints;
  };
}

export type VideoMixerSettingsResponse = VideoMixerSettings &
  ResponseMetadata & {
    _constraints?: CommonPipeSettingsConstraints & {
      program?: VideoMixerOutputSettingsConstraints;
      preview?: VideoMixerOutputSettingsConstraints;
      video_sources?: VideoSourceSourceSettingsConstraints;
      mutable: MutableList;
      [key: string]: unknown;
    };
  };

export interface VideoMixerOutputStatus {
  layers: Array<{ input: VideoSourceStatus }>;
}

export interface VideoMixerStatus extends CommonPipeStatus {
  video_out: VideoOutStatus;
  program?: VideoMixerOutputStatus;
  video_source_pip?: VideoSourceStatus;
  video_sources: VideoSourceStatus[];
  preview?: VideoMixerOutputStatus;
}

export interface VideoMixer extends CommonPipeInfo {
  thumbnails?: PipeThumbnails;
  settings?: VideoMixerSettingsResponse;
  status?: VideoMixerStatus;
  _constraints?: CommonPipeConstraints;
}

export interface VideoMixersList {
  video_mixers: VideoMixer[];
  _links?: Link[];
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export interface FirmwareStatus {
  datetime: string;
  valid?: boolean;
  version: string;
}

/** One row of `GET /system/available_firmwares` (upgrade server + USB media candidates). */
export interface AvailableFirmware {
  version: string;
  release?: string;
  source: string;
  datetime?: string;
}

/**
 * Wrapper shape inferred from this API's otherwise-universal
 * `{ <plural_key>: T[] } & common_response_metadata` list convention — the
 * unit's swagger dump doesn't name a distinct response schema for this
 * endpoint (only the `available_firmware` element type), unlike the Muxing
 * settings note elsewhere in this file, so this is a low-risk inference
 * rather than a guess: worst case it's read via `.available_firmwares` and
 * gets an empty list back until confirmed against a real unit.
 */
export interface AvailableFirmwaresResponse extends ResponseMetadata {
  available_firmwares: AvailableFirmware[];
}

export interface SystemStatus {
  upgrade_media_present?: boolean;
  profile?: { href: string; name: string };
  firmware: {
    default: FirmwareStatus;
    recovery?: FirmwareStatus;
    upgrade_progress_description?: string;
    running: FirmwareStatus;
  };
  memory?: { total: number; available: number };
  battery?: {
    current?: number;
    seconds_to_full?: number;
    charge?: number;
    seconds_to_empty?: number;
    voltage?: number;
    temperature?: number;
    average_current?: number;
  };
  upgrade_server?: { address: string; port: number };
  remote_management?: {
    status_description: string;
    network_interface?: string;
    address?: string;
    via_http: boolean;
    connected: boolean;
  };
  datetime: string;
  talkback?: {
    status_description: string;
    network_interface?: string;
    via_http: boolean;
    audio_outputs?: number;
    connected: boolean;
    audio_inputs?: number;
    audio_interface_description?: string;
  };
  cpu?: { usage: number };
}

export interface SystemInformation {
  product_type: string;
  status?: SystemStatus;
  firmware: string;
  _constraints?: { capabilities: { encryption: boolean }; mutable: MutableList };
  description: string;
  model_name: string;
  _links?: Link[];
  access_key: string;
  serial: string;
  messages?: ApiMessage[];
  language: string;
  oem: string;
  full_model_name: string;
  product_image_version?: string;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface StorageStatus {
  _links?: Link[];
  format_in_progress?: boolean;
  model?: string;
  vendor?: string;
  file_system?: string;
  size?: number;
  used?: number;
  raid?: {
    disks: Array<{
      vendor?: string;
      model?: string;
      status: string;
      serial?: string;
      size?: number;
    }>;
    status: string;
    rebuild_progress?: number;
    size?: number;
  };
  removable: boolean;
  present: boolean;
  busy?: boolean;
}

// ---------------------------------------------------------------------------
// Network interfaces
// ---------------------------------------------------------------------------

export interface NetworkInterfaceSettings {
  mode: string;
  netmask?: string;
  address?: string;
  dns?: string;
  gateway?: string;
  multicast_enabled: boolean;
}

export interface NetworkInterfaceStatus {
  testing_internet_access?: boolean;
  ethernet?: { link?: number; duplex?: string; address: string };
  tx_bitrate: number;
  internet_access: boolean;
  primary_interface: boolean;
  cellular_modem?: {
    sim?: {
      iccid?: string;
      sim_card?: string;
      status_description?: string;
      provider?: string;
    };
    service?: {
      type: string;
      simple_signal_strength: number;
      status_description: string;
      signal_rssi?: number;
      provider?: string;
    };
    connected: boolean;
    status_description: string;
    modem?: { vendor?: string; model?: string; imei?: string; revision?: string };
    helptext_description?: string;
    error_description?: string;
  };
  rx_bitrate: number;
  kasat_modem?: { symbol_rate?: number; rx_snr?: number };
  ip?: { address: string; netmask: string };
}

export interface NetworkInterface {
  href: string;
  _links?: Link[];
  name: string;
  index: number;
  type: string;
}

export interface NetworkInterfacesList {
  status?: { _links?: Link[]; status: NetworkInterfaceStatus[] };
  network_interfaces: NetworkInterface[];
  settings?: ResponseMetadata & { settings: NetworkInterfaceSettings[] };
  _links?: Link[];
}

// ---------------------------------------------------------------------------
// Users & sessions
// ---------------------------------------------------------------------------

export interface UserSession {
  username: string;
  _links?: Link[];
  user: string;
  href: string;
  session_id: string;
}

export interface UserSettings {
  role: string;
  password?: string;
  username: string;
  permissions: Array<{ role?: string; resource: string }>;
  _version?: string;
}

export interface User {
  username: string;
  _links?: Link[];
  settings?: UserSettings;
  href: string;
}

export interface UserList {
  _links?: Link[];
  users: User[];
}

// ---------------------------------------------------------------------------
// Profiles (full-unit presets — the only creatable resource besides users/sessions)
// ---------------------------------------------------------------------------

export interface ProfileBrief {
  index: number;
  description: string;
  _links?: Link[];
  href: string;
}

export interface ProfilesList {
  profiles: ProfileBrief[];
  _links?: Link[];
}

// ---------------------------------------------------------------------------
// Test picture (unit-wide fallback source) — `GET /test_picture`,
// `GET/PUT /test_picture/settings`, `GET/PUT /test_picture/custom_background`.
// The last one is a raw image (no JSON schema in the unit's swagger) rather
// than a typed settings object — see the custom-background client/proxy
// notes in intinor-client.ts.
// ---------------------------------------------------------------------------

export interface TestPictureSettings {
  active: boolean;
  background: string;
  audio: string;
  text_overlay?: string;
  animation_overlay?: string;
}

export interface TestPictureSettingsConstraints {
  mutable: MutableList;
  background: DescriptionDocumentationValue[];
  audio: DescriptionDocumentationValue[];
  animation_overlay: DescriptionDocumentationValue[];
  /** Documents the `%h`/`%m`/`%s`-style codes usable inside `text_overlay`. */
  layout_codes: DescriptionDocumentationValue[];
  default_text_overlay: string;
}

export type TestPictureSettingsRequest = TestPictureSettings & RequestMetadata;

export type TestPictureSettingsResponse = TestPictureSettings &
  ResponseMetadata & { _constraints?: TestPictureSettingsConstraints };

export interface TestPicture {
  _links?: Link[];
  settings?: TestPictureSettingsResponse;
}

// ---------------------------------------------------------------------------
// API root
// ---------------------------------------------------------------------------

export interface ApiRootInfo {
  api_version: string;
  _links?: Link[];
  system?: SystemInformation;
  encoders?: EncodersList;
  network_inputs?: NetworkInputsList;
  video_mixers?: VideoMixersList;
  network_interfaces?: NetworkInterfacesList;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface StmError {
  message: string;
  title: string;
  status: number;
  exception?: string;
}

export interface ValidationError extends StmError {
  errors?: ApiMessage[];
}
