/**
 * Mock data for MOCK=1 mode — realistic payloads matching the schemas in
 * docs/02-intinor-api-definitions-full.md, modelled on unit D01393
 * ("Direkt router basic mobile"): 1× network input, 1× video mixer,
 * 1× encoder. All UI work can run against this without touching the unit.
 */

import type {
  Encoder,
  EncodersList,
  EncoderSettingsResponse,
  EncoderStatus,
  EncodingModesResponse,
  NetworkInput,
  NetworkInputsList,
  NetworkInputSettingsResponse,
  NetworkInputStatus,
  NetworkInterfacesList,
  SystemInformation,
  SystemStatus,
  VideoInput,
  VideoInputSettingsResponse,
  VideoInputsList,
  VideoInputStatus,
  VideoMixer,
  VideoMixersList,
  VideoMixerSettingsResponse,
  VideoMixerStatus,
} from "../types";

const UNIT_BASE = `/api/v1/units/${process.env.INTINOR_UNIT_ID || "D01393"}`;

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export const mockSystemStatus: SystemStatus = {
  datetime: new Date().toISOString(),
  cpu: { usage: 23.4 },
  memory: { total: 4046512128, available: 2710917120 },
  battery: {
    charge: 87,
    voltage: 12.4,
    temperature: 31.2,
    current: -0.42,
    seconds_to_empty: 10440,
  },
  firmware: {
    running: { version: "S5.1.2-1", datetime: "2025-11-04T09:12:00Z", valid: true },
    default: { version: "S5.1.2-1", datetime: "2025-11-04T09:12:00Z", valid: true },
    recovery: { version: "S4.9.0-2", datetime: "2024-06-11T13:37:00Z", valid: true },
  },
  profile: { name: "Default", href: `${UNIT_BASE}/profiles/0` },
  remote_management: {
    connected: true,
    via_http: false,
    status_description: "Connected to iss.intinor.se",
    network_interface: "eth0",
    address: "iss.intinor.se",
  },
  talkback: {
    connected: false,
    via_http: false,
    status_description: "Not connected",
    audio_inputs: 1,
    audio_outputs: 1,
  },
};

export const mockSystem: SystemInformation = {
  product_type: "direkt_router",
  model_name: "Direkt router",
  full_model_name: "Direkt router basic mobile",
  description: "HD Networks — mobile encoder",
  serial: process.env.INTINOR_UNIT_ID || "D01393",
  firmware: "S5.1.2-1",
  access_key: "MOCK-ACCESS-KEY",
  language: "en",
  oem: "intinor",
  messages: [],
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/system` }],
};

// ---------------------------------------------------------------------------
// Network input 0 — SRT listener ingest
// ---------------------------------------------------------------------------

export const mockNetworkInputSettings: NetworkInputSettingsResponse = {
  description: "Main ingest (SRT listener)",
  active: true,
  network_sources: {
    srt_caller: {
      active: false,
      address: "",
      port: 7001,
      latency: 120,
      stream_id: "",
      password: "",
      rendezvous: false,
    },
    udp_unicast: {
      active: true,
      network_interface: "eth0",
      port: 6001,
      srt: { latency: 120, password: "" },
      rist: { latency: 120, password: "" },
    },
    udp_multicast: { active: false, address: "239.0.0.1", port: 5004 },
    tcp_receive: { active: false, port: 6100 },
    tcp_request: { active: false, address: "", port: 6200 },
    rtmp: { active: false, url: "", stream: "" },
    advanced: { tcp_receive_buffer: 2.0, decoder_buffer: 0.5 },
    encryption: false,
  },
  destinations: { basic: [] },
  recording: {
    mpegts: { active: false, path: "recordings/", max_file_size: 4096 },
  },
  access_control: [
    { active: false, description: "Field crew laptop", ip: "", key: "", serial: "" },
  ],
  _version: "mock-1",
  _constraints: {
    mutable: ["*"],
    capabilities: { deactivatable: true },
    destinations: {
      protocol: [
        { value: "srt", type: "srt", description: "SRT" },
        { value: "udp", type: "udp", description: "UDP" },
      ],
    },
  },
};

export const mockNetworkInputStatus: NetworkInputStatus = {
  active: true,
  description: "Main ingest (SRT listener)",
  messages: [],
  network_source: {
    source_type: "srt",
    address: "203.0.113.24:6001",
    bitrate: 8_412_000,
    encrypted: false,
    packet_loss: 0.02,
    srt: {},
    programs: [
      {
        id: "1",
        number: 1,
        name: "Camera 1",
        messages: [],
        thumbnail: `${UNIT_BASE}/network_inputs/0/thumbnails/program_1`,
        video: {
          format: {
            width: 1920,
            height: 1080,
            interlaced: false,
            framerate: 25,
            display_aspect: "16:9",
            pixel_aspect: "1:1",
            forced_aspect: false,
            top_field_first: false,
            chroma_subsampling: "4:2:0",
          },
          codec: { name: "h264", adaptive_bitrate: false, bitrate: 8_000_000 },
        },
        audio: [
          {
            description: "Stereo",
            format: { sample_rate: 48000, bit_depth: 16, channels: 2 },
            codec: { name: "aac", adaptive_bitrate: false, bitrate: 192_000 },
          },
        ],
        buffers: { reception: 0.12, decoder: 0.5, target: 0.5 },
        end_to_end_delay: { delay: 0.62, target: 0.6 },
      },
    ],
  },
  destinations: { basic: [] },
};

export const mockNetworkInput: NetworkInput = {
  name: "network_input",
  type: "network_input",
  index: 0,
  description: "Main ingest (SRT listener)",
  active: true,
  href: `${UNIT_BASE}/network_inputs/0`,
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/network_inputs/0` }],
};

export const mockNetworkInputsList: NetworkInputsList = {
  network_inputs: [mockNetworkInput],
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/network_inputs` }],
};

// ---------------------------------------------------------------------------
// Video input 0 — "Netvideo in 1": a second, distinct ingest resource from
// network_input, offering pull-based sources (RTSP/HLS/NDI/RTMP) in addition
// to SRT caller/listener. See the NetvideoSourceSettings note in types.ts.
// ---------------------------------------------------------------------------

export const mockVideoInputSettings: VideoInputSettingsResponse = {
  description: "Netvideo in 1",
  active: true,
  netvideo_source: {
    type: "srt_listener",
    srt_listener: { port: 7501, latency: 120, password: "", rendezvous: false },
    audio_select: [{ value: "auto", target: "auto" }],
  },
  _version: "mock-1",
  _constraints: {
    mutable: ["*"],
    capabilities: { deactivatable: true },
    netvideo_source: {
      type: [
        { value: "rtsp_pull", description: "RTSP (pull)" },
        { value: "hls", description: "HLS (pull)" },
        { value: "ndi", description: "NDI" },
        { value: "srt_caller", description: "SRT caller" },
        { value: "srt_listener", description: "SRT listener" },
        { value: "rtmp_receive", description: "RTMP (receive)" },
        { value: "rtmp_pull", description: "RTMP (pull)" },
      ],
      rtmp_receive: { rtmp_url_example: "rtmp://<unit-address>/live" },
      audio_select: [{ target: "auto", description: "Automatic" }],
      network_interface: [{ value: "eth0", description: "Ethernet 1" }],
      advanced: {
        source_clock_reconstruction: [
          { value: 0, description: "Disabled" },
          { value: 1, description: "Enabled" },
        ],
      },
    },
  },
};

export const mockVideoInputStatus: VideoInputStatus = {
  active: true,
  description: "Netvideo in 1",
  messages: [],
  netvideo_source: {
    srt: { address: "203.0.113.55:7501", bitrate: 5_200_000, latency: 120, packet_loss: { before: 0.01, after: 0 } },
  },
  video_in: {
    available: true,
    video: {
      format: {
        width: 1920,
        height: 1080,
        interlaced: false,
        framerate: 25,
        display_aspect: "16:9",
        pixel_aspect: "1:1",
        forced_aspect: false,
        top_field_first: false,
        chroma_subsampling: "4:2:0",
      },
      codec: { name: "h264", adaptive_bitrate: false, bitrate: 5_000_000 },
    },
    audio: [
      {
        description: "Stereo",
        format: { sample_rate: 48000, bit_depth: 16, channels: 2 },
        codec: { name: "aac", adaptive_bitrate: false, bitrate: 128_000 },
      },
    ],
  },
};

export const mockVideoInput: VideoInput = {
  name: "video_input",
  type: "video_input",
  index: 0,
  description: "Netvideo in 1",
  active: true,
  href: `${UNIT_BASE}/video_inputs/0`,
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/video_inputs/0` }],
};

export const mockVideoInputsList: VideoInputsList = {
  video_inputs: [mockVideoInput],
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/video_inputs` }],
};

// ---------------------------------------------------------------------------
// Video mixer 0 — program with 2 layers (ready for quad-grid work later)
// ---------------------------------------------------------------------------

export const mockVideoMixerSettings: VideoMixerSettingsResponse = {
  description: "Program mix",
  active: true,
  video_sources: [{ source: `${UNIT_BASE}/network_inputs/0`, program_id: 1 }],
  video_out: { format: "1920x1080p/25", sd_aspect_ratio: "16:9" },
  audio: {
    muted: false,
    input: { source: `${UNIT_BASE}/network_inputs/0`, program_id: 1 },
  },
  program: {
    background: "black",
    layers: [
      {
        input: { source: `${UNIT_BASE}/network_inputs/0`, program_id: 1 },
        layout: { x: 0, y: 0, zoom: 1.0 },
      },
      {
        input: { source: `${UNIT_BASE}/test_picture` },
        layout: { x: 0.7, y: 0.7, zoom: 0.25 },
      },
    ],
  },
  layout_profiles: [],
  source_profiles: [],
  _version: "mock-1",
  _constraints: {
    mutable: ["*"],
    capabilities: { deactivatable: true },
    video_out: {
      format: [
        { value: "1920x1080p/25", description: "1080p25" },
        { value: "1920x1080p/50", description: "1080p50" },
        { value: "1280x720p/50", description: "720p50" },
        { value: "1280x720p/25", description: "720p25" },
      ],
      sd_aspect_ratio: [
        { value: "16:9", description: "16:9" },
        { value: "4:3", description: "4:3" },
      ],
    },
    program: {
      layers: {
        array_size: { min: 0, max: 8 },
        layout: {
          x: { min: -1, max: 1 },
          y: { min: -1, max: 1 },
          zoom: { min: 0.05, max: 2 },
        },
        // Sources this unit can feed into a mixer layer. Only network_inputs/0
        // is a live feed today; test_picture is always available as a filler.
        // The moment a second unit or an upgraded licence adds inputs, they
        // show up here and the quad builder fills real slots with no code
        // change (the UI reads this list, never a hardcoded set).
        input: {
          source: [
            {
              name: "Network input 1",
              value: `${UNIT_BASE}/network_inputs/0`,
              description: "Main ingest (SRT listener)",
              multiprogram: true,
            },
            {
              name: "Test picture",
              value: `${UNIT_BASE}/test_picture`,
              description: "Built-in test pattern",
            },
          ],
        },
      },
    },
  },
};

export const mockVideoMixerStatus: VideoMixerStatus = {
  active: true,
  description: "Program mix",
  messages: [],
  video_out: {
    audio: [
      {
        format: { sample_rate: 48000, bit_depth: 16, channels: 2 },
      },
    ],
    video: {
      format: {
        width: 1920,
        height: 1080,
        interlaced: false,
        framerate: 25,
        display_aspect: "16:9",
        pixel_aspect: "1:1",
        forced_aspect: false,
        top_field_first: false,
        chroma_subsampling: "4:2:0",
      },
    },
  },
  video_sources: [
    {
      available: true,
      source: `${UNIT_BASE}/network_inputs/0`,
      program_id: 1,
      thumbnail: `${UNIT_BASE}/network_inputs/0/thumbnails/program_1`,
    },
  ],
};

export const mockVideoMixer: VideoMixer = {
  name: "video_mixer",
  type: "video_mixer",
  index: 0,
  description: "Program mix",
  active: true,
  href: `${UNIT_BASE}/video_mixers/0`,
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/video_mixers/0` }],
};

export const mockVideoMixersList: VideoMixersList = {
  video_mixers: [mockVideoMixer],
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/video_mixers` }],
};

// ---------------------------------------------------------------------------
// Encoder 0 — SRT push to a distribution endpoint
// ---------------------------------------------------------------------------

export const mockEncoderSettings: EncoderSettingsResponse = {
  description: "Program out (SRT push)",
  active: true,
  video_source: {
    source: `${UNIT_BASE}/video_mixers/0`,
    fallback: "test_picture",
  },
  encoding: { encoding_mode: "1080p25_8mbit", adaptive_bitrate: true },
  destinations: {
    basic: [
      {
        id: "dest-1",
        protocol: "srt",
        address: "ingest.example-cdn.com",
        port: 9001,
        active: true,
        description: "Primary CDN ingest",
        srt: {
          latency: 250,
          password: "",
          stream_id: "hdnetworks-program",
          key_length: 0,
          rendezvous: false,
        },
        failover: [],
      },
    ],
    rtmp: [
      { id: "rtmp-1", description: "Backup RTMP relay", active: false, url: "", stream: "" },
    ],
    srt_on_request: { active: true, local_port: 9000 },
    tcp_on_request: { active: false, local_port: 9100 },
  },
  recording: {
    mpegts: { active: false, path: "recordings/", max_file_size: 4096 },
    flv: { active: false, path: "recordings/", max_file_size: 4096 },
  },
  access_control: [
    { active: false, description: "Studio truck", ip: "", key: "", serial: "" },
  ],
  muxing: {
    mode: "dvb_compatible",
    transport_stream_id: 0,
    program_number: 1,
    mp2_audio_stream_type: "mpeg2_layer2",
    video: { pid: 260 },
    audio: [{ pid: 250 }],
    pcr: { repetition_interval: 0.04 },
    pat: { pid: 0 },
    pmt: { pid: 1000, repetition_interval: 0.1 },
    dvb: {
      nit: { network_name: "Intinor", network_id: 64, repetition_interval: 10 },
      eit: { repetition_interval: 2 },
      tdt: { repetition_interval: 30 },
      sdt: { service_name: "Direkt", service_provider_name: "HD Networks", repetition_interval: 2 },
    },
    klv_metadata: { active: false },
    authentication_metadata: { active: false },
  },
  _version: "mock-1",
  _constraints: {
    mutable: ["*"],
    capabilities: { deactivatable: true },
    muxing: {
      mode: [
        { value: "dvb_compatible", description: "DVB compatible" },
        { value: "generic", description: "Generic" },
      ],
      mp2_audio_stream_type: [
        { value: "mpeg2_layer2", description: "MPEG-2 Audio Layer II" },
        { value: "aac_adts", description: "AAC ADTS" },
      ],
    },
    encoding: {
      capabilities: { adaptive_bitrate: true },
      encoding_mode: [
        {
          id: "1080p25_8mbit",
          group: "hd",
          group_description: "HD",
          description: "1080p25 H.264 8 Mbit/s",
          total_bitrate: 8_192_000,
        },
        {
          id: "720p50_4mbit",
          group: "hd",
          group_description: "HD",
          description: "720p50 H.264 4 Mbit/s",
          total_bitrate: 4_096_000,
        },
      ],
    },
    destinations: {
      capabilities: { encryption: true },
      protocol: [
        { value: "srt", type: "srt", description: "SRT" },
        { value: "rist", type: "rist", description: "RIST" },
        { value: "udp", type: "udp", description: "UDP" },
      ],
      basic: {
        rist: { key_length: [{ name: "128", value: 128 }] },
        network_interface: [{ value: "eth0", description: "Ethernet 1" }],
      },
    },
    video_source: {
      source: [
        { name: "Video mixer 1", value: `${UNIT_BASE}/video_mixers/0` },
        { name: "Network input 1", value: `${UNIT_BASE}/network_inputs/0`, multiprogram: true },
        { name: "Test picture", value: `${UNIT_BASE}/test_picture` },
      ],
      fallback: [
        { value: "test_picture", description: "Test picture" },
        { value: "freeze", description: "Freeze last frame" },
      ],
    },
  },
};

export const mockEncoderStatus: EncoderStatus = {
  active: true,
  description: "Program out (SRT push)",
  messages: [
    {
      severity: "notice",
      message: "Adaptive bitrate active on destination 'Primary CDN ingest'",
    },
  ],
  video_source: {
    available: true,
    source: `${UNIT_BASE}/video_mixers/0`,
    fallback: false,
    thumbnail: `${UNIT_BASE}/encoders/0/thumbnails/video_source`,
  },
  encoding: {
    total_bitrate: 8_192_000,
    video: {
      codec: {
        name: "h264",
        profile: "high",
        level: "4.1",
        bitrate: 8_000_000,
        adaptive_bitrate: true,
        adaptive_bitrate_min: 2_000_000,
        adaptive_bitrate_max: 8_000_000,
      },
      format: {
        width: 1920,
        height: 1080,
        interlaced: false,
        framerate: 25,
        display_aspect: "16:9",
        pixel_aspect: "1:1",
        forced_aspect: false,
        top_field_first: false,
        chroma_subsampling: "4:2:0",
      },
    },
    audio: [
      {
        description: "Stereo",
        format: { sample_rate: 48000, bit_depth: 16, channels: 2 },
        codec: { name: "aac", adaptive_bitrate: false, bitrate: 192_000 },
      },
    ],
  },
  destinations: {
    basic: [
      {
        id: "dest-1",
        bitrate: 8_412_000,
        packet_loss: 0.01,
        messages: [],
      },
    ],
    srt_on_request: { clients: [] },
  },
  recording: {
    mpegts: { status: "inactive", duration: 0, messages: [] },
  },
};

export const mockEncoder: Encoder = {
  name: "encoder",
  type: "encoder",
  index: 0,
  description: "Program out (SRT push)",
  active: true,
  href: `${UNIT_BASE}/encoders/0`,
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/encoders/0` }],
};

export const mockEncodersList: EncodersList = {
  encoders: [mockEncoder],
  _links: [{ rel: "self", method: "GET", href: `${UNIT_BASE}/encoders` }],
};

// ---------------------------------------------------------------------------
// Encoding modes
// ---------------------------------------------------------------------------

export const mockEncodingModes: EncodingModesResponse = {
  encoding_modes: [
    {
      id: "1080p25_8mbit",
      description: "1080p25 H.264 8 Mbit/s",
      group: "hd",
      group_description: "HD",
      total_bitrate: 8_192_000,
      video: {
        codec: "h264",
        format: "1920x1080p/25",
        bitrate: 8_000_000,
        profile: "high",
        level: "4.1",
        gop: 50,
        chroma: "4:2:0",
      },
      audio: { codec: "aac", bitrate: 192_000, tracks: 1, samplerate: 48000 },
    },
    {
      id: "720p50_4mbit",
      description: "720p50 H.264 4 Mbit/s",
      group: "hd",
      group_description: "HD",
      total_bitrate: 4_096_000,
      video: {
        codec: "h264",
        format: "1280x720p/50",
        bitrate: 3_900_000,
        profile: "main",
        level: "3.2",
        gop: 100,
        chroma: "4:2:0",
      },
      audio: { codec: "aac", bitrate: 192_000, tracks: 1, samplerate: 48000 },
    },
  ],
};

// ---------------------------------------------------------------------------
// Network interfaces
// ---------------------------------------------------------------------------

export const mockNetworkInterfaces: NetworkInterfacesList = {
  network_interfaces: [
    { name: "eth0", index: 0, type: "ethernet", href: `${UNIT_BASE}/network_interfaces/0` },
    { name: "wwan0", index: 1, type: "cellular", href: `${UNIT_BASE}/network_interfaces/1` },
  ],
  status: {
    status: [
      {
        primary_interface: true,
        internet_access: true,
        rx_bitrate: 8_612_000,
        tx_bitrate: 8_934_000,
        ethernet: { link: 1000, duplex: "full", address: "aa:bb:cc:00:13:93" },
        ip: { address: "192.168.10.42", netmask: "255.255.255.0" },
      },
      {
        primary_interface: false,
        internet_access: false,
        rx_bitrate: 0,
        tx_bitrate: 0,
        cellular_modem: {
          connected: false,
          status_description: "No SIM card",
        },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// API root (minimal — _links only, subresources fetched separately)
// ---------------------------------------------------------------------------

export const mockApiRoot = {
  api_version: "1.18.0",
  _links: [
    { rel: "self", method: "GET", href: `${UNIT_BASE}/` },
    { rel: "encoders", method: "GET", href: `${UNIT_BASE}/encoders` },
    { rel: "network_inputs", method: "GET", href: `${UNIT_BASE}/network_inputs` },
    { rel: "video_mixers", method: "GET", href: `${UNIT_BASE}/video_mixers` },
    { rel: "system", method: "GET", href: `${UNIT_BASE}/system` },
  ],
};
