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

- **Custom encoding modes CRUD**, **custom test picture upload**, **router
  panel** (drag-and-drop patch bay UX), **richer firmware upgrade flow**,
  **settings backup save**, and **local user/RBAC provisioning on the unit
  itself** — all still just the fixed dropdown / single-button versions
  described in the Phase 5-7 sections above.

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
