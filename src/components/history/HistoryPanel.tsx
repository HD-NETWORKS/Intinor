"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUnit } from "@/lib/units/context";
import { TimeSeriesChart, type Series } from "./TimeSeriesChart";

interface HistoryPoint {
  ts: string;
  cpu: number | null;
  memoryPct: number | null;
  storagePct: number | null;
  encoderBitrate: number | null;
  inputBitrate: number | null;
  inputPacketLoss: number | null;
  egressPacketLoss: number | null;
  interfaceTx: Record<string, number | null>;
  signal: Record<string, number | null>;
}

interface AlertRow {
  id: number;
  kind: string;
  subject: string;
  severity: string;
  message: string;
  opened_at: string;
  closed_at: string | null;
}

interface HistoryResponse {
  configured: boolean;
  unitId: string;
  hours?: number;
  points: HistoryPoint[];
  alerts: AlertRow[];
  message?: string;
  error?: string;
}

const RANGES = [
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 168, label: "7d" },
];

function fmtMbit(v: number): string {
  return `${(v / 1_000_000).toFixed(1)}M`;
}
function fmtPct(v: number): string {
  return `${v.toFixed(0)}%`;
}
function fmtLoss(v: number): string {
  return `${v.toFixed(2)}%`;
}

export function HistoryPanel() {
  const { unitId } = useCurrentUnit();
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;
    fetch(`/api/history?hours=${hours}&unit=${encodeURIComponent(unitId)}`)
      .then((r) => r.json())
      .then((d: HistoryResponse) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hours, unitId]);

  const points = useMemo(() => data?.points ?? [], [data]);
  const asMs = useMemo(() => points.map((p) => new Date(p.ts).getTime()), [points]);

  const throughput: Series[] = useMemo(
    () => [
      {
        name: "Ingest",
        colorSlot: 0,
        points: points.map((p, i) => ({ ts: asMs[i], value: p.inputBitrate })),
      },
      {
        name: "Encoder out",
        colorSlot: 1,
        points: points.map((p, i) => ({ ts: asMs[i], value: p.encoderBitrate })),
      },
    ],
    [points, asMs],
  );

  const cpu: Series[] = useMemo(
    () => [{ name: "CPU", colorSlot: 0, points: points.map((p, i) => ({ ts: asMs[i], value: p.cpu })) }],
    [points, asMs],
  );

  const loss: Series[] = useMemo(
    () => [
      {
        name: "Ingest loss",
        colorSlot: 0,
        points: points.map((p, i) => ({ ts: asMs[i], value: p.inputPacketLoss })),
      },
      {
        name: "Egress loss",
        colorSlot: 1,
        points: points.map((p, i) => ({ ts: asMs[i], value: p.egressPacketLoss })),
      },
    ],
    [points, asMs],
  );

  if (!loading && data && !data.configured) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          History &amp; alerts
        </h2>
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-5 text-sm text-slate-400">
          <p className="text-slate-300">History storage isn&apos;t configured yet.</p>
          <p className="mt-1 text-slate-500">
            {data.message} Until then the dashboard still shows live status — it just
            can&apos;t look backwards.
          </p>
        </div>
      </section>
    );
  }

  const openAlerts = (data?.alerts ?? []).filter((a) => !a.closed_at);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          History &amp; alerts
        </h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => {
                if (r.hours !== hours) setLoading(true);
                setHours(r.hours);
              }}
              className={
                "rounded border px-2.5 py-1 text-xs " +
                (r.hours === hours
                  ? "border-sky-500/60 bg-sky-500/10 text-sky-300"
                  : "border-slate-700 text-slate-400 hover:bg-slate-800")
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {openAlerts.length > 0 && (
        <ul className="space-y-1.5">
          {openAlerts.map((a) => (
            <li
              key={a.id}
              className={
                "rounded border px-3 py-2 text-sm " +
                (a.severity === "error"
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300")
              }
            >
              <span className="font-medium">{a.severity === "error" ? "●" : "▲"} {a.message}</span>
              <span className="ml-2 text-xs opacity-70">
                since {new Date(a.opened_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {loading && !data ? (
        <p className="text-sm text-slate-500">Loading history…</p>
      ) : points.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-5 text-sm text-slate-400">
          No samples in this window yet. The monitor writes one row per poll — history
          appears once the scheduled job has run a few times.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TimeSeriesChart
            title="Throughput (Mbit/s)"
            series={throughput}
            format={fmtMbit}
            emptyMessage="No throughput samples yet."
          />
          <TimeSeriesChart title="CPU (%)" series={cpu} format={fmtPct} maxHint={100} />
          <TimeSeriesChart
            title="Link quality — packet loss (%)"
            series={loss}
            format={fmtLoss}
            emptyMessage="No packet-loss samples yet."
          />
          <RecentAlerts alerts={data?.alerts ?? []} />
        </div>
      )}
    </section>
  );
}

function RecentAlerts({ alerts }: { alerts: AlertRow[] }) {
  return (
    <figure className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <figcaption className="mb-2 text-sm font-medium text-slate-200">
        Alert history
      </figcaption>
      {alerts.length === 0 ? (
        <p className="text-sm text-slate-500">No alerts in this window. </p>
      ) : (
        <ul className="max-h-44 space-y-1.5 overflow-auto">
          {alerts.map((a) => (
            <li key={a.id} className="text-xs">
              <span
                className={
                  "mr-1.5 inline-block h-2 w-2 rounded-full align-middle " +
                  (a.closed_at
                    ? "bg-slate-600"
                    : a.severity === "error"
                      ? "bg-red-400"
                      : "bg-amber-400")
                }
              />
              <span className="text-slate-300">{a.message}</span>
              <span className="ml-1 text-slate-500">
                — {new Date(a.opened_at).toLocaleString()}
                {a.closed_at
                  ? `, resolved ${new Date(a.closed_at).toLocaleTimeString()}`
                  : ", ongoing"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
