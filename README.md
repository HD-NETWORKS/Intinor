# HD Networks — Intinor Direkt Dashboard

Custom web dashboard for the Intinor **Direkt router basic mobile** (unit
D01393), replacing/augmenting Intinor's IDM console for day-to-day broadcast
workflow. Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.

The unit's REST API (Swagger/OpenAPI 2.0) is documented in
[`docs/01-intinor-api-reference.md`](docs/01-intinor-api-reference.md) and
[`docs/02-intinor-api-definitions-full.md`](docs/02-intinor-api-definitions-full.md)
— treat those as ground truth for API shapes.

## Architecture

```
Browser ──> src/proxy.ts                (dashboard login gate — every request)
        ──> src/lib/intinor-client.ts   (typed, per-resource-group functions)
        ──> /api/unit/<path>            (default unit) or /api/units/{id}/<path>
        ──> https://<host>/api/v1/units/{id}/<path>   (session-auth'd)
```

- **The dashboard has its own login**, independent of the unit's credentials
  below. `src/proxy.ts` (Next's request-intercepting "Proxy", formerly
  Middleware) gates every route behind a signed session cookie; see Phase 5.
- **No unit credentials in the browser.** The backend mints a temporary
  session id via `POST /users/{username}/sessions` and authenticates as
  `username:session_id`. The real password lives only in server env vars.
- **Mock mode (`MOCK=1`)**: the proxy serves realistic fake JSON from
  `src/lib/intinor/mock/` — all UI work happens without touching a unit.
- **Read-only by default**: the proxy rejects every `PUT`/`POST`/`DELETE`
  against a live unit unless `INTINOR_ALLOW_WRITES=1` is set (per-feature,
  after review). `system/actions/*` (`reboot`, `power_cycle`, `shutdown`,
  `upgrade_firmware`, `restart_streams`) and a few others (config restore,
  storage format/RAID rebuild, media-bank clear) are **permanently blocked**
  by the generic proxy regardless — see `src/lib/intinor/server/guard.ts`.
  The `system/actions/*` group has a dedicated, separately-gated escape hatch:
  see Phase 5's Danger zone.
- **Multi-unit by config, not by rewrite**: nothing above `server/config.ts`
  hardcodes a unit id or host. One unit is configured with `INTINOR_UNIT_*`;
  additional units — reached at the same `https://iss.intinor.se/api/v1/units/{id}/`
  shape with a different id, or on a different host — are added via
  `INTINOR_UNITS` (a JSON array) and are immediately reachable at
  `/api/units/{id}/...` and monitored by the same cron job. See Phase 5.
- **No fake capacity**: each unit has 1× network input, 1× video mixer,
  1× encoder, fixed by hardware/license — there is no API to add more. The UI
  iterates over whatever the API returns (no hardcoded index 0) and labels
  counts as hardware-fixed.

- **Live polling with ETag/If-None-Match**: `src/hooks/usePolledResource.ts`
  polls a unit-relative path every 5s and sends back the last `ETag` as
  `If-None-Match`; unchanged status data comes back as a 304 (no re-render).
  The proxy forwards this both ways, and mock mode computes a real ETag
  (SHA-1 of the JSON body) so `MOCK=1` exercises the same conditional-GET
  path as the live unit.

### Key files

| Path | Purpose |
| --- | --- |
| `src/lib/intinor/types.ts` | TypeScript types derived from the swagger definitions |
| `src/lib/intinor-client.ts` | Typed browser client (`getEncoders()`, `putEncoderSettings()`, …) |
| `src/app/api/unit/[[...path]]/route.ts` | Proxy route (auth, guard, mock switch, ETag passthrough) |
| `src/lib/intinor/server/` | Server-only: config, session minting, unit fetch, safety guard |
| `src/lib/intinor/mock/` | Mock payloads, ETag/route resolver, and per-tick jitter for `MOCK=1` |
| `src/app/api/meta/route.ts` | Mode flags for the UI banner (never secrets) |
| `src/hooks/usePolledResource.ts` | ETag-aware polling hook used by every status panel |
| `src/components/panels/` | Per-resource read-only status cards + system/network-interface panels |
| `src/lib/settings/` | Field-permission matcher, path get/set, diff, GET-modify-PUT builder |
| `src/components/settings/` | Permission-aware form fields, confirm-diff dialog, form shell |
| `src/components/mixer/` | Layout canvas, layer editor, profiles, preview, output settings |
| `src/lib/monitor/` | Snapshot collector, alert rules, Supabase store, notification channels |
| `src/app/api/cron/poll/` | The scheduled monitoring job (read-only, loops every configured unit) |
| `src/app/api/history/route.ts` | Chart data for the history panel |
| `src/components/history/` | Inline-SVG time-series charts + alert timeline |
| `supabase/schema.sql` | Tables + the partial unique index that makes alerting idempotent |
| `src/proxy.ts` | Dashboard login gate — runs on every request (Next's "Proxy", formerly Middleware) |
| `src/lib/auth/` | Session cookie sign/verify, credential check — the dashboard's own auth, not the unit's |
| `src/app/login/`, `src/app/api/auth/` | Login page + login/logout routes |
| `src/lib/intinor/server/config.ts` | Multi-unit registry: `getUnitConfig(id?)`, `listUnitIds()`, `defaultUnitId()` |
| `src/app/api/units/[unitId]/` | Multi-unit proxy + danger-zone actions for any configured unit |
| `src/lib/intinor/server/system-actions.ts` | The two-gate design behind `system/actions/*` (Danger zone) |
| `src/components/system/DangerZone.tsx` | Reboot/shutdown/etc. UI — separate page, separate confirm flow |
| `src/lib/units/context.tsx` | `UnitProvider`/`useCurrentUnit` — selected unit + its proxy base, persisted |
| `src/components/UnitSwitcher.tsx` | Header `<select>` for the configured units — a no-op with only one |
| `src/hooks/useIntinorClient.ts` | `IntinorClient` bound to whichever unit is currently selected |
| `src/components/panels/PipeTable.tsx`, `NetworkInputRow.tsx`, `EncoderRow.tsx` | Dense/filterable list view for high pipe counts |
| `src/lib/intinor/mock/bigUnit.ts` | Synthetic 16-input/17-encoder/2-mixer fixture for testing the above at scale |
| `src/hooks/useSourceUsage.ts` | Cross-references encoder/mixer sources into a `source → consumers` map |
| `EditableLayer`/`withEnabled`/`stripEnabled` (`src/lib/mixer-layout.ts`) | Dashboard-only per-layer enable/disable, stripped before the real PUT |

## Phase 1 — read-only fleet/status dashboard

The overview page (`/`) shows, entirely via `GET` requests:

- A card per network input, video mixer, and encoder — active/inactive,
  live bitrate, video format, codec, and a thumbnail preview with a PPM
  (audio peak-meter) overlay toggle.
- A system panel — CPU, memory, firmware version, battery — with a banner
  if the running firmware differs from the unit's recommended version.
- A network interfaces panel — per-interface link status, IP, rx/tx bitrate.

Everything polls independently every 5 seconds and nothing here can write to
the unit — there is no settings UI yet.

## Phase 2 — settings editors, gated by field-level permissions

`/encoders`, `/inputs`, and the mixer's output card are editable forms driven
entirely by the unit's own `_constraints`:

- **Field-level permissions.** Every field is checked against
  `_constraints.mutable` before it is rendered as editable. The matcher
  (`src/lib/settings/mutable.ts`) implements the API's dot/bracket syntax
  including array wildcards (`destinations[].active` matches
  `destinations[0].active`) and parent-grant cascade. It is **fail-safe**: a
  resource that doesn't report `mutable` is treated as fully read-only, with a
  banner saying so, rather than being assumed editable. Locked fields stay
  visible (the value is useful) but are disabled and marked `🔒 read-only`.
- **Options come from the unit.** Encoding modes, protocols, sources,
  interfaces and output formats are all populated from `_constraints` — the UI
  never offers a value the unit didn't list. If a current value isn't in the
  list it's preserved as a `(current)` option rather than silently rewritten.
- **GET → modify → PUT.** On save the settings are re-fetched, *only the
  fields the user actually changed* are applied onto that fresh copy, and the
  result is PUT back with `_version` echoed. A concurrent edit elsewhere is
  therefore not clobbered — and if it touched a field you also changed, the
  confirmation dialog warns before you overwrite it.
- **Confirmation diff on every write.** "Description: *Main ingest* →
  *Edited in dashboard*", with the settings path shown underneath. On a live
  unit with writes enabled it additionally requires typing `SAVE`.

Run `npm test` to exercise the permission matcher (25 assertions covering
wildcards, cascades, boundaries, and the fail-safe path).

### Trying the restricted-permission behaviour

The mock can impersonate a restricted account, so the read-only handling is
testable without a non-admin login on the unit:

```bash
MOCK=1 MOCK_ROLE=operator npm run dev   # only some fields editable
MOCK=1 MOCK_ROLE=viewer   npm run dev   # everything read-only
MOCK=1 MOCK_ROLE=unknown  npm run dev   # unit reports no permissions → fail-safe
```

## Phase 3 — quad/collage mixer builder

The video-mixer page (`/mixer`) is a visual layout builder for the mixer's
`program.layers`:

- A 16:9 canvas of drag-to-move / corner-to-resize boxes, each mapping to a
  layer's `{ x, y, zoom }` (top-left position + size as a fraction of the
  frame). A layer list gives precise numeric control, source assignment,
  reordering (back↔front), add, and delete.
- Presets: **2×2 Quad**, picture-in-picture, 1-big-3-small, side-by-side,
  single — arbitrary `x/y/zoom` per layer, not just grids.
- Named **layout profiles** (save / load / delete) so switching between e.g.
  "Sunday service quad" and "single cam" is one click. These are a
  dashboard-level concept stored in `localStorage` (the unit's own
  `layout_profiles` array carries only unnamed positional data), keyed
  per-unit + per-mixer.
- A **live program preview** polled from the mixer's own thumbnail endpoint,
  shown alongside the editing canvas so you can tell applied output from
  unsaved edits.
- An honest **slot-coverage banner**: with one live network input, a quad
  shows "1 of 4 slots has a live source; 3 use the test picture" rather than
  faking four feeds. The moment more inputs exist (a second unit or a licence
  upgrade), they appear in the source picker and fill real slots — the UI
  reads the unit's constraint list, never a hardcoded set.

### Applying — the write path

Applying a layout is the project's first write (`PUT
/video_mixers/{i}/settings`), so it is gated:

- **Mock mode** — applies to an in-memory mock store (`mock/state.ts`); the
  mock program thumbnail re-renders the composited layout, so the whole
  build→apply→see-it-in-preview loop works with zero risk to the unit.
- **Live, read-only** (default against the real unit) — the Apply button is
  disabled and the proxy would reject the `PUT` anyway.
- **Live, writes enabled** (`INTINOR_ALLOW_WRITES=1`) — Apply requires a
  type-to-confirm (`APPLY`) step, since it changes a live broadcast
  composition.

## Phase 4 — alerting & light history

A scheduled job polls the unit, stores a time-series row, and alerts on
transitions. This is the one thing the stock IDM console doesn't give you: the
ability to answer *"what happened at 3am?"* after the fact.

### ⚠️ Vercel Hobby cron is once per day, not once per minute

Worth knowing before you wire this up: **Vercel's Hobby (free) plan limits cron
jobs to a once-per-day cadence** — a more frequent expression fails at deploy
time — and Vercel doesn't guarantee the exact minute a job fires. So a
per-minute poll is not something the free tier can do on its own.

That doesn't block the feature, because `/api/cron/poll` is **trigger-agnostic
and cadence-independent**: alerts key off state *transitions* rather than
elapsed time, so the endpoint behaves correctly whether it runs every minute or
once a day. Pick a trigger:

| Trigger | Cadence | Notes |
| --- | --- | --- |
| `vercel.json` cron (committed) | daily | The most Hobby allows; a safety net, not real monitoring |
| An external pinger (cron-job.org, EasyCron, UptimeRobot…) | 1–5 min | **Recommended on the free tier.** Point it at `/api/cron/poll?secret=…` |
| A GitHub Actions scheduled workflow | ≥5 min | Free-tier minutes apply; scheduled runs can be delayed under load |
| Vercel Pro | any | Removes the limit if you'd rather stay in one place |

Whatever calls it must present `CRON_SECRET` — as `Authorization: Bearer …`
(what Vercel Cron sends) or `?secret=…`. If `CRON_SECRET` is unset the endpoint
refuses to run rather than sitting open.

### What it does each run

1. **Collects** a snapshot — `system/status`, `network_interfaces`,
   `storage/status`, and every encoder's and input's status. **GETs only**: the
   monitor never writes to the unit, so it's safe to run unattended against a
   live broadcast.
2. **Stores** one row in Supabase (free-tier Postgres) — CPU, memory, storage,
   firmware, and per-pipe/per-interface detail as JSON so more encoders or a
   second unit need no migration.
3. **Evaluates** the alert rules and diffs them against the episodes already
   open, so notifications fire on change, not on every poll.

### Alerts that don't cry wolf

Rules report *conditions that are true now*; the job diffs that against open
episodes and notifies only on transitions. **A stream down for an hour produces
one message and one recovery — not sixty.** A partial unique index on
`(unit_id, kind, subject) where closed_at is null` enforces that at the database
level too.

| Rule | Fires when |
| --- | --- |
| `stream_down` | An encoder or input is *active* but moving 0 bit/s |
| `firmware_update` | Running firmware ≠ the version the unit recommends |
| `storage_full` | Storage ≥ 90% used (and a storage device is actually present) |
| `link_loss` | An interface that **had** connectivity loses it |

`link_loss` is deliberately transition-scoped: this unit's cellular modem has no
SIM and is permanently down, and a naive "is it up?" check would alert on it
every poll forever.

Channels — Telegram, Slack, email (Resend), and a generic JSON webhook — are
each inactive until configured, so a fresh deploy sends nothing until you wire
up a destination. `ALERTS_DRY_RUN=1` resolves channels but logs instead of
sending.

### History charts

The dashboard gains a 6h / 24h / 7d panel: throughput (ingest vs encoder out),
CPU, and link quality (packet loss), plus an alert timeline. Charts are inline
SVG with no charting dependency — one y-axis each (never dual-axis), series
colours fixed per entity, a crosshair readout, and a table view for exact
values. The palette is validated for colour-vision deficiency against this
dashboard's own dark surface.

### Verifying alerting before you trust it

Alerting is the one feature you can't check by looking at it. `MOCK_FAULT`
injects each condition on demand:

```bash
MOCK=1 MOCK_FAULT=stream_down          npm run dev
MOCK=1 MOCK_FAULT=link_loss,storage_full npm run dev
```

Point `ALERT_WEBHOOK_URL` at any receiver, hit `/api/cron/poll?secret=…` a few
times, and confirm you get one message per condition — not one per poll.

## Phase 5 — polish & multi-unit readiness

Three things, none of them a new feature so much as making the last four
phases safe and extensible to actually deploy:

### The dashboard's own login

Nothing before this phase gated the dashboard itself — a session-authenticated
proxy to the unit is not a login for *this app*, and the unit's credentials
never reach the browser, so they couldn't double as one either. Anyone who
found the Vercel URL got the whole dashboard.

`src/proxy.ts` (Next 16 renamed Middleware to **Proxy** — same mechanism, see
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`)
now gates every route behind a signed session cookie:

- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` / `AUTH_SECRET` — one shared
  operator account, not a user table. `AUTH_SECRET` signs a stateless cookie
  (`payload.HMAC-SHA256(payload)`, no session store, no extra dependency).
- **Fails closed**: if any of the three are unset, every request is refused
  (500) rather than silently left open — the same posture as `CRON_SECRET`.
  `DASHBOARD_AUTH_DISABLED=1` is the explicit, documented opt-out, for local
  dev only — never set it anywhere reachable from the internet.
- `/login`, `/api/auth/*`, `/api/meta` (no secrets), and `/api/cron/poll`
  (authenticates separately via `CRON_SECRET`, called by an external
  scheduler with no browser session) are the only exempt paths.

### Danger zone — `system/actions/*`, on purpose, behind two gates

Phase 0's guard permanently blocked `reboot`, `power_cycle`, `shutdown`,
`restart_streams`, and `upgrade_firmware` at the generic proxy, with a note
that reaching them needed "a dedicated route with a type-to-confirm UI." This
phase builds that route — on `/system`, its own page, with nothing routine
anywhere near it:

1. **Deploy-time gate**: `INTINOR_ALLOW_DESTRUCTIVE_ACTIONS=1`, off by
   default and independent of `INTINOR_ALLOW_WRITES` — turning on routine
   settings writes must never quietly turn this on too.
2. **Per-request gate**: each action card is collapsed until you click it
   open, then requires typing the action's own name (e.g. `REBOOT`) — not a
   generic "SAVE", so confirming one action can't be muscle-memoried into
   confirming a different one.

`src/lib/intinor/server/system-actions.ts` checks both before ever calling
`POST system/actions/{action}`; mock mode always allows it (nothing real to
protect) so the whole confirm-and-run flow is testable without a unit.

### Multi-unit: config change, not a rewrite

`src/lib/intinor/server/config.ts` now holds a small unit registry instead of
a single implicit unit. The primary unit still comes from the plain
`INTINOR_UNIT_*` vars (existing deployments need no changes); additional
units are one line of JSON in `INTINOR_UNITS`. The moment a unit is added:

- `/api/units/{id}/...` proxies to it (same guard, same mock switch).
- `/api/units/{id}/system-actions` gets its own Danger zone endpoint.
- `/api/cron/poll` polls it too — alerting and history cover it with zero
  code changes, because the cron loop already iterates `listUnitIds()`.

This was deliberately *just* the plumbing when it shipped — no fleet UI, the
dashboard still pointed at the default unit only. Phase 6 below builds the
UI on top of it.

## Phase 6 — unit switcher & dense list view for high pipe counts

Phase 5 made a second unit *reachable*; this phase makes it *usable* — plus a
list view that doesn't fall over on a unit with 16 inputs and 17 encoders
instead of this one's 1-of-each.

### Unit switcher

`src/lib/units/context.tsx` (`UnitProvider` / `useCurrentUnit`) loads the
configured unit list from `/api/meta` once, tracks which one is selected
(persisted in `localStorage`), and exposes the right proxy base for it. It
renders as a `<select>` in the header (`UnitSwitcher.tsx`) — invisible for the
common single-unit setup, since `units.length <= 1` renders nothing.

Everything that talks to a unit reads from this context instead of a fixed
default:

- `usePolledResource` resolves its fetch base from `useCurrentUnit()`
  internally, so every status panel re-points itself the moment the unit
  changes — no prop-drilling needed.
- `useIntinorClient()` returns an `IntinorClient` bound to the selected unit,
  for thumbnails and the settings pages' GET/PUT calls.
- The mixer builder's saved layout profiles, the history panel's `?unit=`
  query, and — importantly — the **Danger zone** all follow the selection
  too: reboot/shutdown/etc. now hit `/api/units/{id}/system-actions` for
  whichever unit is picked, not always the default. (This was a real gap
  until this phase: the danger zone UI previously showed the current unit but
  the button always fired at the default unit's endpoint regardless.)

### Dense list view

The Overview page's signal-chain section now has a Cards/List toggle,
defaulting to List once input+encoder count passes 8 (a small unit reads
better as cards; a rack unit doesn't). `PipeTable.tsx` is the shell (search
box + rows); `NetworkInputRow.tsx`/`EncoderRow.tsx` render a compact
thumbnail + status dot + source/format + bitrate line — same per-row polling
the card grid already did, just laid out for scale instead of a big card
each.

### Trying it without the second unit in hand

`MOCK=1` mode generates a synthetic 16-input/17-encoder fixture
(`src/lib/intinor/mock/bigUnit.ts`) for any configured unit id other than the
primary one:

```bash
MOCK=1 INTINOR_UNITS='[{"id":"D01796","host":"mock","username":"mock","password":"mock","label":"HD networks 17 ch"}]' npm run dev
```

Pick it from the unit switcher — the list view, filter box, and Danger zone
(confirm text correctly says "on D01796") all exercise the real code path a
second physical unit would.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified against
the mock big unit: switching units re-points every panel (system stats,
signal chain, network interfaces, history) with no stale data left over;
Network inputs (16) and Encoders (17) both render fully once their (parallel,
per-row) fetches resolve; the filter box narrows correctly; Danger zone's
confirm hint and the actual POST target both follow the selected unit
(verified directly against `/api/units/D01796/system-actions` vs
`/api/system-actions`); the unit selection survives a full page reload.

## Phase 7 — multi-mixer routing, per-layer toggle, cross-resource usage indicators

Requested after testing Phase 6 against the 16-input/17-encoder fixture: the
mixer builder only ever managed the unit's first mixer, sources couldn't be
temporarily pulled from a layout without deleting the layer, and nothing told
you when two encoders (or two mixers) were quietly pointed at the same input.

### Multi-mixer picker

`/mixer` gained a `PipePicker` (same component the encoder/input pages already
use) for selecting which of the unit's mixers to build — previously hardcoded
to `mixers.video_mixers[0]`. Switching mixers remounts the editor (`key={selectedMixer}`,
same pattern as the encoder/input settings pages), so each mixer gets its own
fresh load/layers/profiles. The mock big-unit fixture now has two mixers
(`BIG_MIXER_COUNT`) so this is actually exercisable without real hardware.

### Per-layer enable/disable

A dashboard-only concept — the unit's own API has no notion of a disabled
layer; a layer either exists in `program.layers` or it doesn't. `EditableLayer`
(`mixer-layout.ts`) adds a client-side `enabled` flag: disabling a layer keeps
its source/position configured (and preserved in saved profiles) but excludes
it from what `Apply` actually sends — `stripEnabled()` filters and strips the
flag right before the PUT. Disabled layers render dimmed with an "OFF" tag on
the canvas rather than disappearing, so repositioning before re-enabling is
still possible.

### Encoder sources already included mixers — the big unit just didn't say so

The encoder's `_constraints.video_source.source` list already mixes input and
mixer options generically (nothing in the settings UI special-cases source
type) — but the big-unit mock fixture, like the mixer bug fixed just before
this phase, only ever listed index 0 of each. `bigEncoderSettings()` now lists
every input and every mixer, mirroring `bigVideoMixerSettings()`.

### Usage indicators — a heads-up, never a block

`useSourceUsage()` fetches every encoder's and mixer's settings for the
current unit once (not polled — this is for editing pages, not the live
status view) and cross-references their source references into a
`source → consumers` map. Wired into:

- The encoder source picker and the mixer layer source picker — options
  already in use elsewhere get `— used by Encoder #3, Mixer #1` appended to
  the label.
- The network input settings page — a banner reading `Used by: …` when
  anything currently sources from it.

Selecting an already-used source is never blocked — some fan-out is
legitimate (an input feeding both a mixer and a monitoring encoder); the
point is making it visible, not policing it.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified against
the mock big unit (2 mixers): the mixer picker switches between mixer #0
(pre-populated) and #1 (empty, 17 sources available); assigning "Network
input 1" on mixer #1 correctly shows "used by Mixer #0"; disabling that layer
dims it on the canvas, marks it "(disabled)", excludes it from the slot-
coverage count, and disables Apply once no layers remain enabled; the
encoder source picker shows mixer options fanning out to multiple encoders
in the same way; the network input settings page shows "Used by Mixer #0"
for input #0.

## Phase 8 — real-unit ground-truth audit: recording, access control, extra destinations, muxing

The user walked the actual D01796 stock console screen-by-screen and shared
screenshots of every settings tab, to check our data model against ground
truth before launch. Several fields already existed in `types.ts` (matching
`docs/02-intinor-api-definitions-full.md`) but had no settings-page UI at
all — a pure wiring gap, not a missing capability. This phase closes the
cheapest, highest-confidence gaps from that audit:

- **Recording** (`recording.mpegts` / `recording.flv` — active, path, max
  file size) — now rendered on both the encoder and network input settings
  pages.
- **Access control** (`access_control[]` — per-rule IP/key/serial allow-list)
  — one section per configured rule, same on both pages.
- **Network input direct-passthrough destinations** (`destinations.basic[]`
  on `NetworkInputSettings`) — the input can push its raw ingest onward,
  bypassing this unit's own encoders (non-DVB-compliant, but a real, typed
  capability that had no UI).
- **Encoder's other destination shapes** — `destinations.srt_on_request` /
  `tcp_on_request` (unit listens, remote pulls) and `destinations.rtmp[]`
  were already in the mock data and the type system; only `destinations.basic[]`
  had a settings section. All three now render.

The builders above (`recordingSections`, `accessControlSections`,
`basicDestinationSections`, `onRequestDestinationSections`,
`rtmpDestinationSections`) moved into `lib/settings/common-sections.ts` since
the encoder and input pages needed the identical shape — `encoders/page.tsx`'s
inline `destinations.basic[]` loop was extracted rather than duplicated.

### Muxing (new)

The real unit's encoder settings have a "Muxing" tab — transport stream ID,
program number, video/audio PIDs, PCR/PMT timing, and the DVB PSI/SI tables
(NIT/EIT/TDT/SDT) — entirely absent from both bundled API reference docs
(`docs/01-intinor-api-reference.md`, `docs/02-...-full.md`), which predate
this UI on the real unit. `MuxingSettings`/`MuxingSettingsConstraints`
(`lib/intinor/types.ts`) and the "Muxing" section on the encoder page are
built from the screenshots, not a confirmed schema.

**This section's field names are unverified against the live API.** Every
field still goes through the same `_constraints.mutable` gate as everything
else, so a wrong field name fails safe: the constraint key just won't be
present on a real unit's response, and the section either won't render or
won't be editable — it will not send a malformed PUT. Once the real unit's
`GET /encoders/{index}/settings` response (with muxing populated) is
available, `muxing.*` paths and the constraint shape should be reconciled
against it.

### Verified

`npm run build` and `npm run lint` pass. Browser-verified against mock mode:
Destination/SRT-on-request/TCP-on-request/RTMP/Recording/Access rule/Muxing
sections all render with the expected fields and values; editing a muxing
text field and a muxing checkbox produces a correct confirm-diff (`Intinor →
HD Networks Direkt`, `off → on`) against the right dot-paths; saving commits
to the mock state store and survives a reload.

### Still open from the same audit (not in this phase)

- **Router panel** (drag-and-drop patch bay UX), **richer firmware upgrade
  flow**, **settings backup save**, and **local user/RBAC provisioning on
  the unit itself** — still not built.

## Phase 9 — Netvideo inputs (`video_input`), a whole second ingest resource

The biggest gap from the Phase 8 audit: the real D01796 has two distinct
sets of inputs — "IP stream in" (`network_input`, already modeled) and
"Netvideo in" (`video_input`), a second resource type offering pull-based
ingest (RTSP/HLS/NDI/RTMP) in addition to SRT caller/listener. Unlike
Muxing in Phase 8, this one is fully documented in
`docs/02-intinor-api-definitions-full.md` (`video_input`,
`video_input_settings`, `netvideo_source_settings(_constraints)`,
`video_input_status`) — no guessing required.

- **Types** (`lib/intinor/types.ts`): `NetvideoSourceSettings` (one active
  ingest kind at a time, selected by `type`: `rtsp_pull` / `hls` / `ndi` /
  `srt_caller` / `srt_listener` / `rtmp_receive` / `rtmp_pull`), its
  constraints and status shapes, `VideoInputSettings(Response)`,
  `VideoInputStatus`, `VideoInput`, `VideoInputsList`.
- **Client** (`lib/intinor-client.ts`): `getVideoInputs` / `getVideoInput` /
  `getVideoInputSettings` / `putVideoInputSettings` / `getVideoInputStatus` /
  `videoInputThumbnailUrl` — same shape as the existing network-input methods.
- **New page** `/netvideo` (`app/netvideo/page.tsx`): a `PipePicker` plus a
  settings form that only renders the sub-section matching whichever
  ingest kind is actually present in the loaded settings (mirrors how
  `inputs/page.tsx` conditionally renders `network_sources.*`).
- **Mock**: `mockVideoInputSettings`/`Status`/`Input`/`InputsList` (one
  Netvideo input on the primary unit, SRT listener by default) in
  `mock/data.ts`; real GET/PUT routes replacing the old `video_inputs: []`
  stub in `mock/resolve.ts`; `BIG_VIDEO_INPUT_COUNT = 16` and
  `bigVideoInput(Status)/bigVideoInputsList` in `mock/bigUnit.ts`, wired into
  `bigGetRoutes()` the same way as the other big-unit resources.
- **Sources**: Netvideo inputs are a legitimate mixer/encoder source like
  any other pipe. `bigVideoInputSourceOptions()` folds all 16 into both
  `bigEncoderSettings()`'s and `bigVideoMixerSettings()`'s
  `_constraints.video_source.source` / `program.layers.input.source` lists,
  alongside network inputs and mixers.
- **UI**: new "Netvideo inputs" nav entry; `VideoInputCard`/`VideoInputRow`
  mirror the network-input card/row for the overview page's card grid and
  dense list view; signal-chain count line now reads
  `N input · M Netvideo · ...`.
- **Permissions**: `"video_input"` added to the mock role system
  (`mock/permissions.ts`) with its own operator grant.

### Verified

`npm run build` and `npm run lint` pass. Browser-verified: on the primary
mock unit, `/netvideo` shows "Netvideo in 1" (SRT listener, port 7501) as a
distinct settings page from `/inputs`, and the overview card grid shows both
side by side. On the big-unit fixture (`INTINOR_UNITS` with a second entry),
the overview lists "16 input · 16 Netvideo · 2 mixer · 17 encoder", the dense
list view shows a separate "Netvideo inputs (16)" table, all 16 are
selectable/editable on `/netvideo`, and the encoder source dropdown lists
all 35 options (2 mixers + 16 network inputs + 16 Netvideo inputs + test
picture) — confirming Netvideo inputs fan out through the existing
cross-resource usage-indicator machinery with no changes needed there.

## Phase 10 — Custom encoding modes CRUD

The `/encoding` root previously only ever fed `encoding_modes` (a read-only
merged built-in+custom list, for populating a pipe's "Encoding mode"
dropdown). The unit-wide `encoding_settings` resource
(`GET/PUT /encoding/settings`, fully documented in
`docs/02-intinor-api-definitions-full.md`) is where custom modes are
actually authored — this phase adds a page for it, plus the global
defaults that live alongside it.

- **Types**: `EncodingSettings(Response/Request)`, `BuiltinEncodingModesSettings/Constraints`,
  `EncodingSettingsVideoInput(Constraints)`, `CustomEncodingModesConstraints`
  (`video_codecs[]`/`audio_codecs[]`, each carrying its own valid
  bitrate/GOP/chroma/profile/level/latency-mode/sample-rate/downmix ranges —
  the existing `EncodingMode`/`EncodingModeVideo`/`EncodingModeAudio` types
  already matched the schema exactly and needed no changes).
- **Client**: `getEncodingSettings()` / `putEncodingSettings()`.
- **New page** `/encoding-modes`: a "Global" section (built-in-mode audio
  track/downmix defaults, default SD aspect ratio) plus one card per custom
  mode, each with codec-dependent field options (picking `h264` narrows
  format/level/profile/chroma/GOP/bitrate to that codec's own constraint
  entry; picking `hevc` narrows to a different set) — and **Add mode**
  (seeded from the first available codec's constraints) / **Remove**
  buttons per mode.
- **Architecture note — why this page doesn't use `useSettingsEditor`**: every
  other settings page edits a fixed set of fields computed once from the
  loaded object. Custom encoding modes are an arbitrary-length list the user
  can grow or shrink, which that model doesn't fit (there's no fixed path to
  diff against for a mode that doesn't exist yet, or one that's just been
  removed). This page reimplements the same GET → diff → confirm → PUT
  shape independently, reusing the existing pure helpers (`diffSettings`,
  `buildPutBody`, `detectConflicts`, `setAtPath`) and components
  (`SettingsField`, `ConfirmChangesDialog`, the now-exported
  `PermissionBanner`) rather than forking or generalizing the hook for one
  page. Per-field specs are also recomputed from the **draft** here (not the
  original, unlike the rest of the app) so changing a mode's codec
  immediately narrows its other fields' options.
- **Known simplification**: adding or removing a mode is inherently a
  whole-array operation (there's no per-element create/delete endpoint —
  same as everywhere else in this API). When the array length changes, the
  confirm dialog and PUT collapse to one line ("Custom encoding modes:
  N mode(s) → M mode(s)") covering the whole list, rather than itemizing
  every field of the added/removed mode; in-place edits to existing modes
  (no length change) still get fully itemized, field-by-field diffs like
  every other page.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified in
mock mode: editing an existing custom mode's description and adding a new
mode (seeded from the mock's first H.264/AAC constraint entry) collapses to
a single "1 mode(s) → 2 mode(s)" confirm-dialog line; saving persists across
reload; removing a mode back down to 1 also persists correctly.

## Phase 11 — Test picture settings + custom background upload

`docs/01-intinor-api-reference.md` documents three `test_picture` endpoints:
`GET /test_picture`, `GET/PUT /test_picture/settings` (a normal typed
resource — active/background/audio/animation-overlay/text-overlay, all
constraint-driven like everything else), and `GET/PUT
/test_picture/custom_background`, which has **no JSON schema** in the
unit's swagger dump — it's a raw image, not a settings object. Building
this required a real capability the proxy didn't have yet: passing a
binary body through untouched.

- **New page** `/test-picture`: a standard `useSettingsEditor`/`SettingsForm`
  section for the typed settings (background/audio/animation-overlay
  dropdowns come from `_constraints`, same as everywhere else; the
  text-overlay field's help text surfaces the unit's `layout_codes`
  time-code placeholders and `default_text_overlay`), plus a separate
  "Custom background" card with a file input, live preview (`<img>` against
  the proxied `custom_background` URL), and an upload button — this part
  isn't a settings-diff at all, just a direct file PUT.
- **Proxy binary passthrough** (`server/proxy-handler.ts`, `server/unit-fetch.ts`):
  previously every request body went through `req.text()`, which corrupts
  non-UTF8 bytes. The proxy now checks the request's Content-Type and only
  uses `.text()` for JSON/text bodies; anything else (`image/png`, etc.) goes
  through `.arrayBuffer()` and is forwarded as raw bytes end-to-end, both to
  the real unit and into the mock resolver. `intinor-client.ts` gained a
  `putBinary()` path alongside the existing JSON `request()` helper —
  `putCustomBackground(file: Blob)` posts the file's own bytes and
  content-type directly, no JSON envelope.
- **Mock**: a second in-memory store in `mock/state.ts`
  (`putBinaryOverride`/`getBinaryOverride`, parallel to the existing JSON
  `overrides` map, since binary blobs don't fit that map's
  clone-and-strip-`_constraints` logic) holds the uploaded bytes; GET serves
  them back with the original content-type, or a placeholder "NO CUSTOM
  BACKGROUND UPLOADED" SVG if nothing's been uploaded yet.

### Bug caught during verification

The first version of `customBackgroundUrl()` cache-busted with
`` `?_r=${Date.now()}` `` baked into the client method itself. Since the
image `<img src>` is computed during the initial render, this produced a
React hydration-mismatch warning (the server-rendered HTML and the
client's first render computed different timestamps). Fixed by moving the
cache-bust token out of the client method and into caller-owned React state
(a counter starting at `0`/`undefined`, only incremented after a successful
upload) — deterministic across server and client, and still forces a fresh
fetch exactly when the image has actually changed.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Confirmed with a raw
`curl` PUT/GET round-trip that a real PNG survives the proxy byte-for-byte
(`cmp` reported the files identical). Browser-verified: settings edits
(text overlay, background selection) save and persist; uploading a file
through the actual `<input type=file>` + Upload button round-trips
correctly (`img.complete`/`naturalWidth`/`naturalHeight` confirmed against
the uploaded file's real dimensions); no hydration warnings or console
errors on load, edit, or upload.

## Phase 12 — Richer firmware upgrade + settings backup download

Both fully documented in `docs/01-intinor-api-reference.md`:
`GET /system/available_firmwares` (upgrade-server + USB-media candidates),
`POST /system/actions/upgrade_firmware?version=&source=` (previously fired
with no params — just "install whatever the unit already flagged"), and
`GET /system/config` / `PUT /system/config` (XML backup — GET is a safe
read; PUT restores and reboots, and was already permanently blocked at the
proxy since Phase 5, correctly so).

- **Types**: `AvailableFirmware`, `AvailableFirmwaresResponse` — the latter's
  wrapper shape (`{ available_firmwares: [...] } & common_response_metadata`)
  isn't a named schema in the unit's swagger dump, but every other list
  endpoint in this API follows that exact convention, so it's a low-risk
  inference, not a guess — flagged as such in the type's own doc comment.
- **`FirmwarePanel`** (new, on `/system`): read-only running/default/recovery
  firmware versions and dates from `system/status.firmware` (already fully
  typed from earlier phases — no new fields needed there), plus an
  "update available" banner when running ≠ default. Explicitly notes that
  validating firmware integrity or swapping to the recovery slot — both
  visible in the user's screenshots — have no corresponding endpoint in
  either bundled reference doc, so unlike Muxing (Phase 8) this dashboard
  does **not** fabricate actions for them.
- **`BackupPanel`** (new, on `/system`): a "Download backup" button —
  `GET /system/config`, triggers a browser download of the XML. No danger-
  zone gating; it's a plain read. Restoring one stays exactly as blocked as
  before.
- **Danger Zone → Upgrade firmware**: revealing the confirm box now also
  shows a version/channel picker sourced from `getAvailableFirmwares()`,
  defaulting to "the unit's own recommended choice" (no params sent, same
  as before this phase) or a specific candidate. `performSystemAction`
  (`server/system-actions.ts`) gained an optional `{version, source}` param,
  appended as `?version=&source=` only for this one action — still behind
  both existing gates (env flag + typed `UPGRADE_FIRMWARE` confirmation).

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified with
`INTINOR_ALLOW_DESTRUCTIVE_ACTIONS=1`: the firmware picker lists all three
mock candidates; downloading the backup produces a real file with the
expected XML content; selecting a specific firmware version and confirming
sends `POST system/actions/upgrade_firmware?version=S5.2.0-1&source=upgrade_server`
(confirmed via the actual dev server request log) rather than the bare
unparameterized action.

## Phase 13 — Router panel (drag-and-drop source assignment)

The last UX-only item from the original audit: the real unit's Router panel
is a visual patch bay — drag a source thumbnail onto a destination thumbnail
— as an alternative to picking a source from a dropdown on the encoder
settings page. Confirmed this is genuinely just a different UI over the
same write: no new API capability, no new types needed.

- **New page** `/router`: two sections — **Sources** (every network input,
  Netvideo input, video mixer, and the test picture, each a draggable tile
  with a live thumbnail/status dot, reusing `usePolledResource` the same way
  `NetworkInputRow`/`EncoderRow` already do) and **Encoders** (drop targets,
  each showing its current source and highlighting on drag-over).
- The master list of valid sources — and their exact href values — comes
  from an encoder's own `_constraints.video_source.source` (the same
  constraint list the dropdown-based encoder settings page already reads),
  not reconstructed by guessing URL shapes. `parseSourceHref()` maps each
  href back to a resource kind + index (network_inputs/video_inputs/
  video_mixers/test_picture) purely to pick the right thumbnail URL builder.
- **Write path**: dropping a source fetches that encoder's current settings
  once, checks `video_source.source` is mutable for the account, and — if
  so — opens the existing `ConfirmChangesDialog` (same component every
  other settings page uses, so live-write units still get the "type SAVE"
  gate) with a single `SettingsChange` entry. Confirming reuses
  `buildPutBody`/`putEncoderSettings` exactly as the encoder settings page
  does. `useSourceUsage()` (Phase 7) already annotates every source tile
  with "⚠ used by …" for cross-resource fan-out — no changes needed there
  either.
- Deliberately scoped to encoders only, not mixer layers — an encoder has
  exactly one source, a clean drop target; a mixer can have several layers,
  which doesn't reduce to "drop a thumbnail on a thumbnail" without also
  picking which layer, so that stays on the existing mixer builder page.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified on
the primary mock unit: dragging "Network input 1" onto the encoder opens a
confirm dialog reading "Video source: Video mixer 1 → Network input 1";
confirming saves and survives a reload. Re-verified on the big-unit fixture
(2 mixers + 16 network inputs + 16 Netvideo inputs + test picture = 35
source tiles, 17 encoder destinations, all with live thumbnails) with zero
console errors.

## Phase 14 — Local users, read-only

The last open item from the launch audit: the unit's own local user system
(roles, per-category permissions for media bank/recording/test picture/
encoding settings, per-video-resource permissions for every input/encoder)
is entirely separate from this dashboard's own single-shared-account login
(Phase 5). Asked the user directly whether to build nothing, read-only
visibility, or full CRUD here — **read-only visibility** was the call:
security-sensitive, rarely-touched account/permission management is exactly
the kind of thing that should stay on the vendor's own console as the
source of truth, but a glanceable view of "who has access to what" from
the same dashboard is low-risk and genuinely useful.

Fully documented in both bundled reference docs — `GET /users`,
`GET/PUT /users/{username}/settings` — and it turned out `User`/
`UserSettings`/`UserList` were already scaffolded in `types.ts` back in
Phase 0 (matching this schema exactly) even though no page ever used them.
Added only what was missing: `UserSettingsConstraints` (role and
per-resource permission options, each with a human description) and
`UserSettingsResponse`.

- **New page** `/users`: one card per local user — role badge, and a
  permissions table (resource → access level) with labels resolved from
  that user's own `_constraints.permissions` descriptions rather than
  hardcoded strings. No edit, create, or delete controls anywhere — the
  client only has `getUsers()`/`getUserSettings()`, no write methods at
  all, so there's no write path to accidentally expose later.
- Passwords are typed as always write-only/never rendered, matching how
  every other settings page treats password fields.
- Mock: two example accounts (`admin`, `operator`) with realistic
  permission sets, so the page has something to show.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified:
both mock accounts render with correct role badges; the permissions table
shows human-readable resource/access labels (e.g. "IP stream in 1 — Video
user") rather than raw API strings; no console errors.

## Phase 15 — real-unit UX polish

First round of feedback from actually operating against a live unit
(D01796, connected directly by IP once the `iss.intinor.se` cloud relay
turned out to require a paid Intinor SLA subscription — see commit
history for that connectivity fix). Seven fixes, all UI-only:

- **Thumbnails now refresh.** The dense list rows (`NetworkInputRow`,
  `EncoderRow`, `VideoInputRow`) and the router panel tiles
  (`SourceTile`, `EncoderDestTile`) rendered raw `<img>` tags with no
  cache-busting, so a thumbnail only ever showed its first-load frame.
  The card views already solved this via the `Thumbnail` component; that
  logic is now a shared hook (`useThumbnailTick`/`withThumbnailTick` in
  `src/hooks/useThumbnailTick.ts`) so every thumbnail everywhere ticks
  every 10s.
- **SRT/RTMP passphrase show/hide.** `SettingsField`'s password kind now
  renders a relative-positioned eye-icon toggle button instead of a bare
  masked input. One shared component, so this fixes every passphrase
  field app-wide in one place.
- **Dropped the `#N` index numbering.** Card titles, dense-list rows, the
  router panel, and the pipe picker all showed a redundant `#0`-based
  index next to a description that's already a human label (e.g.
  "Encoder 1"). Removed the index display entirely rather than just
  rebasing it to 1 — the description already carries that information.
  Settings-page titles (`Network input N settings`, `Encoder N settings`)
  keep a number, now 1-based instead of 0-based.
- **Removed the battery indicator** from the system panel — not
  applicable hardware for this deployment, dropped unconditionally rather
  than built as a conditional-hide.
- **SRT listener before SRT caller** on the network input settings page —
  matches how the unit is actually used (listening for inbound field
  connections is the common case).
- **Router panel: Encoders before Sources.** Same drag-and-drop
  mechanics, just reordered so the drop targets you're routing *into*
  are the first thing you see.
- **Encoding modes are now collapsible.** Custom modes default to
  collapsed (a chevron + title toggle, sibling to a separate Remove
  button so nothing nests a `<button>` inside a `<button>`), with an
  "Expand all / Collapse all" toggle and a quick-jump chip row once
  there are 2+ modes. Adding a mode expands it immediately; removing a
  mode reindexes the expanded-set bookkeeping so collapse state stays
  attached to the right mode after the array shifts.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified in
mock mode: thumbnails tick, the passphrase toggle reveals/hides typed
text, no `#N` numbering anywhere, battery tile gone (3-column stat grid),
SRT listener section renders above SRT caller, the router panel lists
Encoders before Sources, and a single custom encoding mode renders
collapsed by default with its own expand/remove controls. No console
errors.

## Phase 16 — navigation, mixer visibility, and a light/dark theme

Second round of real-unit feedback, all UI-only:

- **Destination name on router-panel encoder tiles.** `EncoderDestTile` now
  shows the first active push destination's description (from
  `settings.destinations.basic`/`.rtmp`, filtered on `active`), alongside the
  existing "Source: …" line — `"+N more"` when more than one destination is
  active.
- **Click-through navigation.** Every card (Overview), dense-list row, and
  router-panel tile now opens that item's own settings page on click. A new
  `SelectionProvider` (`src/lib/navigation/selection.tsx`) hands the clicked
  index across the route change via a ref (not a URL param, so no Suspense
  boundary or bookmarkable-URL complexity) — the destination page
  (`/inputs`, `/netvideo`, `/mixer`, `/encoders`) consumes it once on load in
  place of its usual "select the first item" default. `useOpenPipeSettings`
  is the one-line hook every card/row/tile uses. `StatusCardShell` grew an
  optional `onClick`, so the whole card becomes a click target without
  fighting the existing "Audio level overlay" checkbox inside `Thumbnail`
  (which now stops click propagation so toggling it doesn't also navigate
  away).
- **Video mixer nav item hides itself** when the connected unit reports zero
  `video_mixers` — `Nav.tsx` polls the list every 30s (cheap, just for
  visibility) and shows the link by default until that first answer arrives,
  so it doesn't flash-hide. There's no dashboard-side way to *enable* a
  mixer a unit doesn't have — pipe counts are fixed by the unit's own
  hardware/license, same as the encoder/input counts elsewhere in this app.
- **Router panel moved above the resource pages** in the sidebar, right
  after Overview.
- **Light/dark theme, defaulting to system.** The whole app was hardcoded
  dark (`bg-slate-950` etc., directly, no variants) — swapped every "chrome"
  color class (page/panel backgrounds, borders, body/muted/faint text,
  accent/status text) for a small set of semantic Tailwind utilities
  (`bg-page`, `bg-panel`, `text-body`, `text-accent`, `text-danger`, …)
  backed by CSS custom properties in `globals.css`, switched by an
  `html[data-theme]` attribute. Deliberately left alone: video/image preview
  "wells" (thumbnails, the mixer canvas, custom-background preview) stay
  black regardless of theme — the video-monitor convention — and so do
  purely decorative bits (status dots, translucent tinted badges, solid
  accent buttons) that already read fine on either background.
  - `ThemeProvider` (`src/lib/theme/context.tsx`) tracks a `system | light |
    dark` preference in `localStorage`, resolves `system` against
    `prefers-color-scheme`, and live-updates if the OS theme changes.
  - An inline script in the root layout sets `data-theme` before first
    paint (the standard Next.js "preventing flash" pattern) from the same
    storage key — no flash on load. The storage-key constant lives in its
    own plain module (`src/lib/theme/constants.ts`) specifically so the
    *server* layout never imports anything from the `"use client"`
    `context.tsx` module — doing that once by mistake corrupted the constant
    into a client-reference stub and broke the inline script's JS syntax,
    caught by browser-console verification, not by `next build`.
  - `ThemeToggle` — a three-way Auto/Light/Dark control — sits in the
    header next to the unit switcher.
  - The one inline-SVG chart (`TimeSeriesChart`) had its grid/axis colors
    hardcoded as hex attributes rather than Tailwind classes; those now
    read `var(--chart-grid)` / `var(--chart-axis-text)` instead.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified in
mock mode, in both themes (`colorScheme: 'dark'` and `'light'`, plus the
in-app toggle): no console errors either way; the router panel shows
destination names; clicking an Overview card navigates to and pre-selects
that item's settings page; the theme toggle switches instantly and
persists; light mode renders correctly end-to-end (nav, header, cards, a
full settings form, the router panel) with video-preview boxes correctly
staying dark in both themes.

## Phase 17 — resizable settings arrays (destination add/remove) and a layout fix

- **Netvideo input settings: SRT listener moved** to right after "Input",
  before RTSP (pull) — matching how the equivalent Network input page was
  already ordered.
- **Encoders can add and remove push destinations**, both the primary
  (`destinations.basic[]`) and RTMP (`destinations.rtmp[]`) kind. This
  needed more than a page-level change — `useSettingsEditor` previously
  derived its form layout (`sections`, and the `specs` list diffing/saving
  are built from) once from the *initial load*, which works fine for
  fixed-shape resources but can't reflect an array a user just grew or
  shrank in the draft. Three changes, all backward-compatible for every
  existing page:
  - `sectionsOf` is now called with the *live draft* (falling back to the
    initial load only before the first render) instead of solely the
    pristine original, and receives a second `ArrayHelpers` argument
    (`addArrayItem`/`removeArrayItem`) a section-builder can wire buttons
    to. Existing single-argument `sectionsOf` functions didn't need any
    changes — only `encoderSections` (the one resource that needed it)
    took the new parameter.
  - `diffSettings` now detects when an array's length itself differs
    between original and draft — an added item has no "before" value to
    diff, a removed one has no "after" — and collapses that into one
    structural change covering the whole array, instead of the
    (necessarily incomplete) per-field diff. Getting this right for
    *removing the last remaining item* took a second pass: once an array is
    emptied, the draft-derived form no longer has any fields under it at
    all, so nothing was left to notice the resize. Fixed by also folding in
    the field paths implied by the *original* shape when building the diff
    input, purely for this detection — not for rendering.
  - `FieldSection` gained an optional `headerExtra` (rendered top-right of
    a section's title) — used for a small "Remove" button per destination
    and a fields-less "+ Add" header section above each list
    (`arrayHeaderSection` in `common-sections.tsx`, which is now `.tsx`
    since it renders these buttons directly).
  - New destinations get a client-generated placeholder id and sensible
    defaults (protocol from `_constraints`, an SRT sub-object when that's
    the default protocol); the unit is free to reassign the id on save.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified in
mock mode: Netvideo settings render SRT listener before RTSP; clicking
"+ Add" on an encoder's push/RTMP destinations immediately shows a new
section with the "unsaved changes" counter incrementing; removing a
destination (including emptying an array to zero) is correctly reflected
in the confirm-changes dialog as a "N item(s) → M item(s)" structural
change; saving both an add and a removal-to-zero in the same edit persists
correctly after reload — no console errors.

## Phase 18 — live preview + snapshot download on input/encoder settings, HD Networks branding

- **Header now shows the real HD Networks logo** (`public/logo.png`,
  transparent background, reads correctly in both themes) instead of a
  plain-text title.
- **Network input, Netvideo input, and Encoder settings pages** each show a
  "Preview" panel above the settings form: a live thumbnail (same
  10s-refresh mechanism used everywhere else) plus a "Download snapshot"
  link that saves the current frame as a JPEG. Reuses the existing
  `Thumbnail` component (now with an optional `downloadFilename` prop —
  a plain same-origin `<a download>`, no extra plumbing needed since the
  thumbnail is already proxied through our own domain) wrapped in a new
  `StreamPreviewSection`, which renders nothing until the pipe actually has
  a thumbnail id (avoids a broken-image flash on first load). Each settings
  page runs one extra lightweight polled fetch (`?include=thumbnails`)
  purely to get that id — the existing `getXSettings()` calls don't
  request it, so this doesn't change what those return or how saving works.

### Verified

`npm run build`, `npm run lint`, `npm test` all pass. Browser-verified in
mock mode: all three settings pages render a Preview panel with a working
"Download snapshot" link (confirmed the link's `href` resolves to a real
same-origin image response, not a broken/dead link) above their forms; the
logo renders with a transparent background in both light and dark themes.
No console errors.

## Getting started

```bash
npm install
cp .env.example .env.local   # defaults to MOCK=1
```

Set `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, and `AUTH_SECRET` in
`.env.local` (or set `DASHBOARD_AUTH_DISABLED=1` to skip login for local-only
work), then:

```bash
npm run dev
```

Open http://localhost:3000, sign in, and the overview page loads encoders /
network inputs / video mixers / system status through the proxy. The unit
proxy itself is behind the login gate too, so `curl` needs the session
cookie — easiest to exercise it from the browser, or curl `/api/meta` which
stays public.

To go live (read-only) against the real unit, set in `.env.local`:
`MOCK=` (empty), `INTINOR_UNIT_HOST`, `INTINOR_UNIT_ID`, `INTINOR_USERNAME`,
`INTINOR_PASSWORD`, and `INTINOR_ALLOW_SELF_SIGNED=1` if connecting by IP.

## Deploying to Vercel

1. Import this repo at https://vercel.com/new (framework auto-detected).
2. Set env vars for the project: `MOCK=1` (until the unit is reachable from
   Vercel — likely via `INTINOR_UNIT_HOST=iss.intinor.se`, since Vercel can't
   reach a LAN IP) **and** `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` /
   `AUTH_SECRET` — the dashboard is reachable from the open internet the
   moment it's deployed, mock mode or not, and the proxy refuses every
   request until those three are set.
3. Every push to `main` deploys; PRs get preview URLs (each needs its own
   `AUTH_SECRET` etc. — set env vars for all environments, or Preview will
   fail closed same as Production).

Phase 0 definition of done: the deployed shell renders (after signing in) and
`https://<app>.vercel.app/api/unit/encoders` returns mock encoder JSON to an
authenticated session.

### Deploying without Vercel's GitHub integration (private org repos)

Vercel's free Hobby plan won't link a private repo owned by a GitHub
*organization* (only individually-owned private repos) — the flow above
will hit "Deploying from a private GitHub organization requires a Vercel
Pro plan" if this repo stays under an org. `.github/workflows/deploy-vercel.yml`
sidesteps that: it deploys via the Vercel CLI with a token, the same as
running `vercel` from a laptop, which has no such restriction regardless of
plan or repo visibility.

One-time setup:

1. Locally: `npm i -g vercel`, then `vercel login` and `vercel link` (creates
   the Vercel project and writes `.vercel/project.json`, gitignored).
2. In this repo's **Settings → Secrets and variables → Actions**, add:
   - `VERCEL_TOKEN` — from `vercel tokens create` (or Account Settings →
     Tokens on vercel.com)
   - `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` — both in `.vercel/project.json`
     after step 1
3. Set the app's own environment variables (`MOCK`, `DASHBOARD_USERNAME`,
   etc. — same list as above) on the Vercel project itself (**Settings →
   Environment Variables**); the workflow only builds and deploys, it
   doesn't manage those.

Every push to `main` then deploys to production automatically (or trigger
it manually from the Actions tab — the workflow has `workflow_dispatch`
too), without ever going through Vercel's GitHub App.
