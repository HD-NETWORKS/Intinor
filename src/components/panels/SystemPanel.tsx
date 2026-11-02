"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import type { SystemStatus } from "@/lib/intinor/types";
import { formatBytes, formatPercent, formatUptime } from "@/lib/format";
import { StatTile } from "../StatTile";

export function SystemPanel() {
  const { data, error } = usePolledResource<SystemStatus>("system/status", 5000);

  if (error && !data) {
    return (
      <div className="rounded border border-signal-red-500/40 bg-signal-red-500/10 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const running = data.firmware.running.version;
  const recommended = data.firmware.default.version;
  const updateAvailable = running !== recommended;
  const usedMemory =
    data.memory != null ? data.memory.total - data.memory.available : undefined;

  const rm = data.remote_management;

  return (
    <div className="space-y-3">
      {updateAvailable && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-warning">
          Firmware update available: running <strong>{running}</strong>, recommended{" "}
          <strong>{recommended}</strong>.
        </div>
      )}
      {data.ntp_synchronized === false && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-warning">
          Clock not synchronized to NTP. Timestamps (recordings, logs, DVB time/date) may drift.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="CPU" value={formatPercent(data.cpu?.usage)} />
        <StatTile
          label="Memory"
          value={
            data.memory
              ? `${formatBytes(usedMemory)} / ${formatBytes(data.memory.total)}`
              : "—"
          }
        />
        <StatTile label="Firmware" value={running} />
        <StatTile label="Uptime" value={formatUptime(data.uptime)} />
        {rm && (
          <StatTile
            label="Remote management"
            value={rm.connected ? (rm.address ?? "Connected") : "Disconnected"}
          />
        )}
      </div>
    </div>
  );
}
