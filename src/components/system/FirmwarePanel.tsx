"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import type { SystemStatus } from "@/lib/intinor/types";

function FirmwareRow({ label, version, datetime, valid }: { label: string; version?: string; datetime?: string; valid?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/40 px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <div className="text-right">
        <div className="text-sm text-slate-200">{version ?? "—"}</div>
        {datetime && (
          <div className="text-[11px] text-slate-500">
            {new Date(datetime).toLocaleString()}
            {valid === false && <span className="ml-1 text-red-400">· invalid</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Read-only firmware status — running/default/recovery slots, per `system/status.firmware`. */
export function FirmwarePanel() {
  const { data, error } = usePolledResource<SystemStatus>("system/status", 10000);

  if (error && !data) {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const f = data.firmware;
  const updateAvailable = f.running.version !== f.default.version;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Firmware</h2>
        <p className="mt-1 text-xs text-slate-500">
          Running, default (installed on next boot), and recovery firmware slots — from{" "}
          <code className="rounded bg-slate-800 px-1">system/status.firmware</code>. There is no
          endpoint to validate firmware integrity or swap to recovery in the API this dashboard
          was built against — only what&apos;s below is exposed.
        </p>
      </div>

      {updateAvailable && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Running <strong>{f.running.version}</strong> differs from default{" "}
          <strong>{f.default.version}</strong> — an upgrade may be pending or was skipped.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <FirmwareRow label="Running" version={f.running.version} datetime={f.running.datetime} valid={f.running.valid} />
        <FirmwareRow label="Default" version={f.default.version} datetime={f.default.datetime} valid={f.default.valid} />
        {f.recovery && (
          <FirmwareRow label="Recovery" version={f.recovery.version} datetime={f.recovery.datetime} valid={f.recovery.valid} />
        )}
      </div>
    </section>
  );
}
