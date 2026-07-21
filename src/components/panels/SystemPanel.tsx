"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import type { SystemStatus } from "@/lib/intinor/types";
import { formatBytes, formatPercent } from "@/lib/format";
import { StatTile } from "../StatTile";

export function SystemPanel() {
  const { data, error } = usePolledResource<SystemStatus>("system/status", 5000);

  if (error && !data) {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
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

  return (
    <div className="space-y-3">
      {updateAvailable && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
          Firmware update available — running <strong>{running}</strong>, recommended{" "}
          <strong>{recommended}</strong>.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
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
        <StatTile
          label="Battery"
          value={data.battery?.charge != null ? `${data.battery.charge}%` : "—"}
        />
      </div>
    </div>
  );
}
