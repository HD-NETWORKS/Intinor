"use client";

import { useEffect, useState } from "react";
import {
  intinorClient,
  IntinorApiError,
} from "@/lib/intinor-client";
import type {
  EncodersList,
  NetworkInputsList,
  SystemStatus,
  VideoMixersList,
} from "@/lib/intinor/types";

interface OverviewData {
  encoders: EncodersList;
  networkInputs: NetworkInputsList;
  videoMixers: VideoMixersList;
  systemStatus: SystemStatus;
}

function PipeCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ index: number; description: string; active: boolean }>;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-medium text-slate-200">{title}</h2>
        <span className="text-xs text-slate-500">
          {items.length} on this unit (fixed by hardware/license)
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">None on this unit.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.index}
              className="flex items-center gap-3 rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
            >
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (item.active ? "bg-emerald-400" : "bg-slate-600")
                }
                title={item.active ? "Active" : "Inactive"}
              />
              <span className="text-slate-400">#{item.index}</span>
              <span className="text-slate-200">
                {item.description || "(no description)"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [encoders, networkInputs, videoMixers, systemStatus] =
          await Promise.all([
            intinorClient.getEncoders(),
            intinorClient.getNetworkInputs(),
            intinorClient.getVideoMixers(),
            intinorClient.getSystemStatus(),
          ]);
        if (cancelled) return;
        setData({ encoders, networkInputs, videoMixers, systemStatus });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof IntinorApiError
            ? `${err.message} (HTTP ${err.status})`
            : err instanceof Error
              ? err.message
              : "Failed to load unit data",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const load = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Unit overview</h1>
        <button
          onClick={load}
          disabled={loading}
          className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                CPU
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">
                {data.systemStatus.cpu
                  ? `${data.systemStatus.cpu.usage.toFixed(0)}%`
                  : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Firmware
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">
                {data.systemStatus.firmware.running.version}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Battery
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">
                {data.systemStatus.battery?.charge != null
                  ? `${data.systemStatus.battery.charge}%`
                  : "—"}
              </div>
            </div>
          </div>

          <PipeCard title="Network inputs" items={data.networkInputs.network_inputs} />
          <PipeCard title="Video mixers" items={data.videoMixers.video_mixers} />
          <PipeCard title="Encoders" items={data.encoders.encoders} />

          <p className="text-xs text-slate-500">
            Pipe counts come straight from the unit&apos;s API — this dashboard
            manages whatever the hardware/license provides and cannot add
            encoders, mixers, or inputs. Additional units (via ISS) will appear
            here when configured.
          </p>
        </>
      )}
    </div>
  );
}
