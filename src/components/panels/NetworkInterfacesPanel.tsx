"use client";

import { useState } from "react";
import { usePolledResource } from "@/hooks/usePolledResource";
import type { NetworkInterfacesList } from "@/lib/intinor/types";
import { formatBitrate } from "@/lib/format";

function CopyIpButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard API unavailable/denied — address is still visible to select and copy by hand.
        }
      }}
      className="rounded border border-border-strong px-2 py-0.5 text-xs text-muted hover:bg-panel-hover"
      aria-label={`Copy ${value} to clipboard`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function NetworkInterfacesPanel() {
  const { data, error } = usePolledResource<NetworkInterfacesList>(
    "network_interfaces?include=status",
    5000,
  );

  if (error && !data) {
    return (
      <div className="rounded border border-signal-red-500/40 bg-signal-red-500/10 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const statuses = data.status?.status;
  const primary = statuses?.find((s) => s.primary_interface) ?? statuses?.[0];
  const primaryIp = primary?.ip?.address ?? primary?.ethernet?.address ?? null;

  return (
    <div className="rounded border border-border-default bg-panel p-4">
      <h2 className="mb-3 font-medium text-body">Network interfaces</h2>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-brand-500/40 bg-brand-500/10 px-3 py-2.5">
        <span className="text-xs font-medium font-mono uppercase tracking-wide text-muted">
          Primary IP
        </span>
        <span className="font-mono text-lg font-semibold text-body">{primaryIp ?? "—"}</span>
        {primaryIp && <CopyIpButton value={primaryIp} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.network_interfaces.map((iface, i) => {
          const status = data.status?.status[i];
          const linked = status?.ethernet
            ? Boolean(status.ethernet.link && status.ethernet.link > 0)
            : Boolean(status?.cellular_modem?.connected);
          const ip = status?.ip?.address ?? status?.ethernet?.address ?? null;

          return (
            <div
              key={iface.index}
              className="rounded border border-border-default bg-panel-strong p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={"h-2 w-2 rounded-full " + (linked ? "bg-emerald-400" : "bg-slate-600")}
                />
                <span className="font-medium text-body">{iface.name}</span>
                <span className="text-xs text-faint">{iface.type}</span>
                {status?.primary_interface && (
                  <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] text-accent">
                    primary
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted">
                <div>RX: {formatBitrate(status?.rx_bitrate)}</div>
                <div>TX: {formatBitrate(status?.tx_bitrate)}</div>
                <div className="flex items-center gap-1.5">
                  IP: {ip ?? "—"}
                  {ip && <CopyIpButton value={ip} />}
                </div>
                <div>{status?.internet_access ? "Internet OK" : "No internet"}</div>
              </div>
              {status?.cellular_modem && !status.cellular_modem.connected && (
                <div className="mt-1 text-xs text-faint">
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
