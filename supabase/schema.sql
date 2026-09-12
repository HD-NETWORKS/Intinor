-- Phase 4 — alerting & light history.
--
-- Run this once in the Supabase SQL editor (free-tier Postgres is plenty for
-- this volume: one sample row per poll, a few hundred bytes each).
--
-- Both tables are written only by the cron job using the *service role* key,
-- which is held server-side and never exposed to the browser. RLS is enabled
-- with no permissive policies, so the anon key cannot read or write either
-- table; the dashboard reads history through our own /api/history route.

-- ---------------------------------------------------------------------------
-- Time series
-- ---------------------------------------------------------------------------

create table if not exists monitor_samples (
  id                  bigserial primary key,
  unit_id             text        not null,
  ts                  timestamptz not null default now(),

  -- system
  cpu_usage           real,
  memory_used_bytes   bigint,
  memory_total_bytes  bigint,
  battery_charge      real,
  storage_used_bytes  bigint,
  storage_size_bytes  bigint,
  firmware_running    text,
  firmware_default    text,

  -- per-pipe / per-interface detail kept as JSON so a second unit (or an
  -- upgraded licence with more encoders) needs no migration
  encoders            jsonb       not null default '[]'::jsonb,
  inputs              jsonb       not null default '[]'::jsonb,
  interfaces          jsonb       not null default '[]'::jsonb
);

create index if not exists monitor_samples_unit_ts_idx
  on monitor_samples (unit_id, ts desc);

-- ---------------------------------------------------------------------------
-- Alerts
--
-- One row per alert *episode*: opened when a condition starts, closed when it
-- clears. The partial unique index is what makes alerting idempotent — a poll
-- that re-detects an already-open condition cannot create a second row, so a
-- stream that is down for an hour produces one alert, not sixty.
-- ---------------------------------------------------------------------------

create table if not exists monitor_alerts (
  id          bigserial primary key,
  unit_id     text        not null,
  kind        text        not null,   -- stream_down | firmware_update | storage_full | link_loss
  subject     text        not null,   -- e.g. 'encoder:0', 'eth0', 'system'
  severity    text        not null,   -- warning | error
  message     text        not null,
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  notified_at timestamptz
);

create unique index if not exists monitor_alerts_open_uniq
  on monitor_alerts (unit_id, kind, subject)
  where closed_at is null;

create index if not exists monitor_alerts_unit_opened_idx
  on monitor_alerts (unit_id, opened_at desc);

-- ---------------------------------------------------------------------------
-- Lock both tables down. No policies are created, so with RLS enabled the
-- anon/public key can do nothing; only the service-role key (which bypasses
-- RLS) can read/write, and that key lives server-side only.
-- ---------------------------------------------------------------------------

alter table monitor_samples enable row level security;
alter table monitor_alerts  enable row level security;

-- ---------------------------------------------------------------------------
-- Optional retention: keep the free tier small. Run manually, or schedule with
-- pg_cron if the project has it enabled.
-- ---------------------------------------------------------------------------

-- delete from monitor_samples where ts < now() - interval '30 days';
-- delete from monitor_alerts  where closed_at is not null
--                              and closed_at < now() - interval '90 days';

-- ---------------------------------------------------------------------------
-- Phase 23 — Zixi snapshot monitoring.
--
-- One row per stream, upserted on every snapshot push from the install-script
-- agent running on each Zixi-sending server (see /api/zixi-snapshot/[id]).
-- The image itself lives in Storage, not here — this table is just the
-- registry + freshness (last_seen_at is how the dashboard flags a stream that
-- has stopped updating).
-- ---------------------------------------------------------------------------

create table if not exists zixi_streams (
  stream_id    text primary key,
  label        text        not null,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

alter table zixi_streams enable row level security;

-- Public storage bucket for the latest snapshot per stream (path: "{stream_id}.jpg",
-- overwritten on every push). Public because these are non-sensitive broadcast
-- thumbnails and it lets the dashboard embed them directly without proxying
-- bytes through our own serverless function on every poll.
insert into storage.buckets (id, name, public)
values ('zixi-snapshots', 'zixi-snapshots', true)
on conflict (id) do nothing;
