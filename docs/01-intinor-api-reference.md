# Intinor DirektAPIServer — API Reference
Unit: D01393 ("Direkt router basic mobile") · Network: HD Networks (1088)
API Server version: 1.18.0 · OpenAPI/Swagger 2.0
Base URL (direct): `https://<unit-ip-or-host>/api/v1/units/D01393`
Base URL (via ISS central management): `https://iss.intinor.se/api/v1/units/D01393`

> This document was hand-compiled from the unit's live Swagger/OpenAPI spec
> (`/networks/1088/unit/D01393/api-docs` → swagger.json) because the source
> is access-locked and can't be linked directly. It is a faithful, complete
> summary of every endpoint and every schema, just reformatted for readability
> and for feeding to an AI coding agent.

---

## 1. Basic principles (from the official docs page)

- Always use **HTTPS** and **HTTP Basic Auth**.
- Pattern for changing settings: **GET → modify → PUT** (fetch the current settings object, change only the fields you want, PUT the whole object back).
- Use the `include` query parameter to bundle subresources into one response instead of making multiple requests, e.g.
  `GET /encoders/0?include=settings,status,thumbnails`
  You can also exclude default-included fields with `!`, e.g. `?include=settings,!_links`.
- Client-side caching is supported via `ETag` / `If-None-Match` headers on GET requests.
- Clients **must** ignore unknown fields in responses (forward compatibility). For best compatibility, unknown fields should be sent back unmodified on PUT — except `_constraints`, `_messages`, `_links`, and included subresources, which should not be sent back unless explicitly being modified.
- Don't send `null` for optional fields you're not changing.

### Special headers
- `X-No-Basic-Auth: 1` — makes a 401 response return `WWW-Authenticate: X-API` instead of `WWW-Authenticate: Basic`, to suppress the browser's native basic-auth popup in custom clients.

### Metadata fields you'll see in responses
- `_constraints` — valid values / min-max / which fields are mutable by the current user, for this resource.
- `_links` — HATEOAS-style related-operation links.
- `_version` — version tag for settings data; echo it back on PUT if present.
- `_messages` — extra warnings/notices to surface in your UI.

### Auth / sessions (important for a custom dashboard)
`POST /users/{username}/sessions` creates a **temporary session ID** that can be used instead of the real password for Basic Auth (`username:session_id`). This is the recommended way to authenticate a custom app without storing/hardcoding the real password. Close a session with `DELETE /users/{username}/sessions/{id}`.

### Access restrictions
- Non-administrator users are restricted on some resources.
- Restrictions can be **resource-level** (an operation like `PUT` on `/system` may require `admin` in `_links`) or **field-level** (a `mutable` array in `_constraints`, using dot-notation / JSONPath-like syntax, e.g. `"mutable": ["video_source.source", "video_source.program_id", "destinations[].active"]`). An empty `mutable: []` means everything is read-only for the current user. `"mutable": ["*"]` means everything is writable.
- **A dashboard must read `_constraints.mutable` per resource and disable/hide fields the logged-in user can't actually change**, rather than assuming access.

### WebDAV
`media_bank` and `storage` expose a `webdav` subresource implementing RFC 4918 (standard WebDAV) — usable with any WebDAV client/library for file browse/upload/download, in addition to the JSON API.

---

## 2. Resource groups on this unit (confirmed live)

This specific unit (D01393) has, per the actual dashboard:
- **1× Network Input** (index 0) — SRT/RTMP/RTP/HLS/NDI ingest
- **1× Video Mixer** (index 0)
- **1× Encoder** (index 0)

⚠️ **There is no API endpoint to create additional encoders, mixers, or network inputs.** All `POST`-capable resources are: `profiles`, `users`, `sessions`. Encoders/mixers/inputs are fixed by the physical unit's hardware/license — the API only lets you *configure* the ones that exist, not add more. (See the note at the end of this document.)

---

## 3. Full endpoint list (167 operations)

Grouped by tag. `*` next to a param name (in section 4) = required.

### root
- `GET /` — API root, returns links to every top-level resource (`api_root_info`)

### system
- `GET /system` — system info: model, serial, firmware, language, access_key (`system_information`)
- `GET /system/status` — CPU %, memory, battery, firmware versions, remote management, talkback status
- `GET /system/messages` / `GET /system/messages/{id}` / `DELETE /system/messages/{id}` — persistent system notices
- `GET /system/available_firmwares` — query upgrade server + USB media for candidate firmwares (can be slow)
- `POST /system/actions/upgrade_firmware?version=&source=` — upgrade + reboot, **stops all streams**
- `POST /system/actions/reboot`, `POST /system/actions/power_cycle`, `POST /system/actions/shutdown`
- `POST /system/actions/restart_streams` — restarts all active streams
- `POST /system/actions/restart_talkback`
- `POST /system/actions/set_time`
- `GET /system/config` (download XML backup) / `PUT /system/config` (restore from XML, multipart upload)
- `GET /system/product_image` — JPEG product photo
- `POST /system/actions/allow_remote_management_user/{username}` / `deny_remote_management_user/{username}` / `request_remote_management` / `restart_remote_management`

### encoder
- `GET /encoders` / `GET /encoders/{index}` — list / single, supports `include=settings,status,thumbnails`
- `GET /encoders/{index}/settings` / `PUT /encoders/{index}/settings` — **GET-modify-PUT** pattern
- `GET /encoders/{index}/status`
- `GET /encoders/{index}/thumbnails` (list) / `GET /encoders/{index}/thumbnails/{id}` (image, JPEG/PNG, params: `width`, `height`, `jpeg_quality`, `ppm` for peak-meter overlay)
- `POST /encoders/{index}/actions/restart`

### video_input / video_output
Same GET/PUT/status/thumbnails/restart shape as encoder, for `/video_inputs` and `/video_outputs`.

### network_input
Same shape as above for `/network_inputs`. This is where SRT/RTMP/RTP/HLS/NDI **ingest** is configured (see §4 `network_sources_settings`).

### video_mixer
Same shape for `/video_mixers`. This is where compositing/layout/PIP/quad-grid is configured (see §4 `video_mixer_pipe_settings`).

### multiview
Same shape for `/multiviews` — a simpler grid preview layout (fixed `layout` codes) distinct from the fully custom `video_mixer` layering.

### network_interface
- `GET /network_interfaces` / `GET /network_interfaces/{index}` / `GET .../settings` / `GET .../status`
- `PUT /network_interfaces/settings` — bulk update
- `POST /network_interfaces/{index}/actions/renew_lease`

### profile
- `GET /profiles` / `POST /profiles` (create) / `GET /profiles/{index}` / `DELETE /profiles/{index}`
- `GET /profiles/{index}/settings` / `PUT /profiles/{index}/settings`
- `GET /profiles/{index}/encoding_modes` / `GET /profiles/{index}/encoding_modes/{id}`
- A profile snapshots settings for encoders, video_inputs, video_outputs, video_mixers, multiviews, network_inputs, network_interfaces, and encoding — i.e. a full-unit preset you can save and re-apply.

### encoding
- `GET /encoding` — root object (settings + encoding_modes)
- `GET /encoding/settings` / `PUT /encoding/settings` — global encoding settings for all active encoders
- `GET /encoding/encoding_modes` / `GET /encoding/encoding_modes/{id}` — built-in + custom encoding mode definitions (codec, bitrate, GOP, profile/level, chroma, latency mode, etc.)

### AES67 (audio-over-IP)
- `GET /aes67` (root), `GET/PUT /aes67/settings`, `GET /aes67/remote_sources`
- `GET/PUT /aes67/sources/settings`, `GET /aes67/sources/sdp/{id}` (SDP file)
- `GET/PUT /aes67/sinks/settings`, `GET /aes67/sinks/status`
- `GET /aes67/ptp`, `GET/PUT /aes67/ptp/settings`, `GET /aes67/ptp/status` (PTP clock sync)

### NDI
- `GET /ndi`, `GET /ndi/streams` — detected NDI streams on the network

### wifi
- `GET /wifi` (root), `GET/PUT /wifi/settings` (known networks list), `GET /wifi/status`
- `GET /wifi/access_point`, `GET/PUT /wifi/access_point/settings`, `GET /wifi/access_point/status`
- `POST /wifi/actions/scan`

### storage / media_bank (WebDAV file storage)
- `GET /storage`, `GET /storage/status`, `GET /storage/tree/{path}`, `DELETE /storage/tree/{path}`
- `GET /storage/webdav`, `GET/PUT/DELETE /storage/webdav/{path}/`
- `POST /storage/actions/format`, `POST /storage/actions/rebuild_raid`
- `GET /media_bank`, `GET /media_bank/status`, `POST /media_bank/actions/clear`
- `GET /media_bank/webdav`, `GET/PUT/DELETE /media_bank/webdav/{path}/`

### ftp_server / ftp_auto_uploader / samba_server
- Standard GET/PUT settings for exposing the unit as an FTP server, auto-uploading recordings to a remote FTP, and exposing storage over SMB/Samba.
- `POST /ftp_auto_uploader/actions/requeue`, `POST /ftp_auto_uploader/actions/test_settings`

### recording
- `GET /recording`, `GET/PUT /recording/settings` — global recording control

### sim_card
- `GET /sim_cards`, `GET /sim_cards/{iccid}`, `GET/PUT /sim_cards/settings` — cellular modem/SIM management (APN, PIN, roaming, force-4G)

### data_cost
- `GET /data_costs`, `GET/PUT /data_costs/settings` — cost tracking per network path, adaptive-bitrate cost ceiling

### test_picture
- `GET /test_picture`, `GET/PUT /test_picture/settings`, `GET/PUT /test_picture/custom_background`

### user
- `GET /users`, `POST /users` (create, admin-only), `GET/DELETE /users/{username}`
- `GET/PUT /users/{username}/settings`
- `POST /users/{username}/sessions` (temporary session-id auth), `DELETE /users/{username}/sessions/{id}`

---

## 4. Key schemas (compact form)

`ref:x` means "see definition x below". `field*` means required. `array<T>` is a list of T.
This is the full, compact shape of every schema on the unit (294 total), auto-derived from the swagger — safe to hand to a code generator.

### Video mixer (the quad/collage engine)
```
video_mixer_pipe_settings :: {
  video_sources*: array<video_source_source_settings>,   // deprecated by program/preview below
  program: video_mixer_output_settings,                  // THE MAIN OUTPUT COMPOSITION
  preview: video_mixer_output_settings,                  // optional secondary output
  video_out*: video_mixer_out_settings,                  // output format, e.g. "1920x1080p/25"
  layout_profiles: array<video_mixer_layout_profiles_settings>,  // saved layout presets
  source_profiles: array<video_mixer_source_profile_settings>,   // saved source presets
  audio: video_mixer_audio_settings
}

video_mixer_output_settings :: {
  layers*: array<video_mixer_layer_settings>,   // ordered back-to-front
  background: string,
  overlay: video_mixer_overlay_settings
}

video_mixer_layer_settings :: {
  input*: video_source_source_settings,     // { source*: <URI to a video_input/network_input>, program_id: int }
  layout*: video_mixer_layer_layout_settings
}

video_mixer_layer_layout_settings :: {
  x*: number,     // 0.0 = left edge, 1.0 = right edge
  y*: number,     // 0.0 = top edge,  1.0 = bottom edge
  zoom*: number   // 0.1 = 10% size, 0.5 = half size, 1.0 = full size
}

video_mixer_out_settings :: {
  format: string,          // "{width}x{height}{i|p}/{framerate}"
  sd_aspect_ratio*: string,
  pip: { zoom*: integer }  // deprecated PIP shortcut
}
```
**2×2 quad grid recipe:** 4 layers, each `zoom: 0.5`, positioned at `(x:0,y:0)`, `(x:0.5,y:0)`, `(x:0,y:0.5)`, `(x:0.5,y:0.5)`, each `input.source` pointing at a different `network_input` URI (one per incoming SRT stream).

### Network input source settings (SRT/RTMP/RTP/HLS ingest)
```
network_sources_settings :: {
  srt_caller*: network_sources_srt_caller,   // this unit connects OUT to a remote SRT server
  udp_unicast*: { ..., srt: {latency*, password*}, rist: {latency*, password*}, port*, network_interface* },
  udp_multicast*: { port*, address*, network_interface, active* },
  tcp_receive*: { port*, active* },
  tcp_request*: { port*, address*, active* },
  rtmp*: { active*, url*, stream* },
  encryption: boolean,
  advanced*: { tcp_receive_buffer*, decoder_buffer }
}

network_sources_srt_caller :: {
  address*: string, port*: integer, latency: number,
  stream_id: string, password: string, adapter: string,
  rendezvous: boolean, active*: boolean
}
```
Note: SRT **listener** mode (unit waits for an incoming connection) is `udp_unicast.srt`, distinct from `srt_caller` (unit dials out). Check `_constraints` on your unit to confirm which modes this specific model supports.

### Encoder destinations (SRT/RTMP/RIST push OUT)
```
destinations_settings :: {
  basic*: array<destinations_settings_basic>,     // one or more push destinations
  srt_on_request*: destinations_srt_on_request,    // unit listens, remote pulls via SRT
  tcp_on_request*: destinations_tcp_on_request,
  rtmp: array<destinations_settings_rtmp>,
  advanced*: destinations_settings_advanced
}

destinations_settings_basic :: {
  protocol*: string,               // e.g. "srt", "rist", "udp"
  address*: string, port*: integer,
  srt: { latency*, password*, stream_id*, rendezvous, key_length* },
  rist: { latency*, password, profile*, key_length },
  failover: array<{ address*, port*, description*, active* }>,  // backup destinations
  active*: boolean, description*: string
}
```

### Encoder settings (root)
```
encoder_settings :: common_pipe_settings + {
  video_source*: video_source_settings,      // { source*: <URI>, program_id, fallback }
  encoding*: pipe_encoding_settings,         // { encoding_mode*: <id>, adaptive_bitrate }
  destinations*: destinations_settings,
  recording*: pipe_recording_settings,       // { mpegts: {...}, flv: {...} }
  access_control: array<access_control_settings>
}
```

### Encoding modes (bitrate/codec presets)
```
encoding_mode :: {
  id*, description*, group, group_description, total_bitrate,
  video*: { codec*, format*, bitrate*, profile*, level*, gop*, chroma*, bitrate_buffer, performance_mode, scene_change_detection },
  audio*: { codec*, bitrate*, tracks*, samplerate, downmix }
}
```

### Thumbnails (for a live monitoring wall)
`GET /{resource}/{index}/thumbnails/{id}?width=&height=&jpeg_quality=&ppm=true`
Returns JPEG/PNG. `ppm=true` overlays a peak-program (audio level) meter — useful for a control-room grid view.

### Status objects (poll these for live dashboards)
```
encoder_status :: { active*, description*, video_source*: video_source_status, encoding*: encoding_status, destinations*: destinations_status, recording* }
network_input_status :: { active*, network_source*: network_source_status, destinations*, recording }
video_mixer_status :: { active*, video_sources*, program, preview, video_out* }
network_interface_status :: { rx_bitrate*, tx_bitrate*, internet_access*, ethernet: {...}, cellular_modem: { sim: {...}, service: {simple_signal_strength*, ...} } }
system_status :: { cpu*: {usage*}, memory*: {total*, available*}, battery*, firmware*: {running*, default*, upgrade_progress_description}, remote_management*, talkback* }
```

### Full raw definitions (all 294, compact)
The complete machine-derived schema list (every definition in the spec, in compact
`name :: {field:type, ...}` form) is in the companion file
**`02-intinor-api-definitions-full.md`** in this same package — use it as the
ground truth when generating TypeScript types / a client SDK, since it's exhaustive
where this document is curated/summarized.

---

## 5. Practical notes for building a client

1. **Auth**: open a session via `POST /users/{username}/sessions`, use `username:session_id` as Basic Auth credentials rather than the real password. Store the session id server-side only (e.g. in an httpOnly cookie or server env), never in client-side JS.
2. **Respect `_constraints.mutable`** on every settings object before rendering editable fields.
3. **Batch reads** with `include=settings,status,thumbnails` to cut request count.
4. **Use ETag/If-None-Match** for efficient polling of status endpoints.
5. **No creation endpoints** for encoders/mixers/inputs/outputs — these are fixed by hardware. Only `profiles`, `users`, and `sessions` are POST-able (creatable).
6. Central-management (ISS) access uses the **same paths**, just rooted at `https://iss.intinor.se/api/v1/units/D01393/` instead of the unit's own address — useful if you ever manage multiple units from one dashboard.
