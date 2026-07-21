"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import type { NetworkInterfacesList } from "@/lib/intinor/types";
import { formatBitrate } from "@/lib/format";

export function NetworkInterfacesPanel() {
  const { data, error } = usePolledResource<NetworkInterfacesList>("network_interfaces", 5000);

  if (error && !data) {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="mb-3 font-medium text-slate-200">Network interfaces</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.network_interfaces.map((iface, i) => {
          const status = data.status?.status[i];
          const linked = status?.ethernet
            ? Boolean(status.ethernet.link && status.ethernet.link > 0)
            : Boolean(status?.cellular_modem?.connected);

          return (
            <div
              key={iface.index}
              className="rounded border border-slate-800 bg-slate-950/50 p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={"h-2 w-2 rounded-full " + (linked ? "bg-emerald-400" : "bg-slate-600")}
                />
                <span className="font-medium text-slate-200">{iface.name}</span>
                <span className="text-xs text-slate-500">{iface.type}</span>
                {status?.primary_interface && (
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">
                    primary
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-400">
                <div>RX: {formatBitrate(status?.rx_bitrate)}</div>
                <div>TX: {formatBitrate(status?.tx_bitrate)}</div>
                <div>IP: {status?.ip?.address ?? status?.ethernet?.address ?? "—"}</div>
                <div>{status?.internet_access ? "Internet OK" : "No internet"}</div>
              </div>
              {status?.cellular_modem && !status.cellular_modem.connected && (
                <div className="mt-1 text-xs text-slate-500">
                  {status.cellular_modem.status_description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
