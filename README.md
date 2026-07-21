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
Browser ──> src/lib/intinor-client.ts (typed, per-resource-group functions)
        ──> /api/unit/<path>          (Next.js route: proxy + safety guard)
        ──> https://<unit>/api/v1/units/D01393/<path>   (session-auth'd)
```

- **No credentials in the browser.** The backend mints a temporary session id
  via `POST /users/{username}/sessions` and authenticates as
  `username:session_id`. The real password lives only in server env vars.
- **Mock mode (`MOCK=1`)**: the proxy serves realistic fake JSON from
  `src/lib/intinor/mock/` — all UI work happens without touching the unit.
- **Read-only by default**: the proxy rejects every `PUT`/`POST`/`DELETE`
  against the live unit unless `INTINOR_ALLOW_WRITES=1` is set (per-feature,
  after review). Destructive endpoints (`reboot`, `power_cycle`, `shutdown`,
  `upgrade_firmware`, `restart_streams`, config restore, storage format/RAID
  rebuild, media-bank clear) are **permanently blocked** by the generic proxy
  — see `src/lib/intinor/server/guard.ts`. Exposing one later requires a
  dedicated route with a type-to-confirm UI.
- **No fake capacity**: the unit has 1× network input, 1× video mixer,
  1× encoder, fixed by hardware/license — there is no API to add more. The UI
  iterates over whatever the API returns (no hardcoded index 0) and labels
  counts as hardware-fixed. Multi-unit support later = one client per unit via
  the identical ISS paths (`https://iss.intinor.se/api/v1/units/{id}/`);
  `createIntinorClient(base)` already takes the proxy base for that reason.

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

## Getting started

```bash
npm install
cp .env.example .env.local   # defaults to MOCK=1
npm run dev
```

Open http://localhost:3000 — the overview page loads encoders / network
inputs / video mixers / system status through the proxy. Try the proxy
directly: `curl http://localhost:3000/api/unit/encoders`.

To go live (read-only) against the real unit, set in `.env.local`:
`MOCK=` (empty), `INTINOR_UNIT_HOST`, `INTINOR_UNIT_ID`, `INTINOR_USERNAME`,
`INTINOR_PASSWORD`, and `INTINOR_ALLOW_SELF_SIGNED=1` if connecting by IP.

## Deploying to Vercel

1. Import this repo at https://vercel.com/new (framework auto-detected).
2. Set env vars for the project: `MOCK=1` (until the unit is reachable from
   Vercel — likely via `INTINOR_UNIT_HOST=iss.intinor.se`, since Vercel can't
   reach a LAN IP).
3. Every push to `main` deploys; PRs get preview URLs.

Phase 0 definition of done: the deployed shell renders and
`https://<app>.vercel.app/api/unit/encoders` returns mock encoder JSON.
