"use client";

import { useState } from "react";
import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type { AvailableFirmware, SystemStatus } from "@/lib/intinor/types";

function FirmwareRow({ label, version, datetime, valid }: { label: string; version?: string; datetime?: string; valid?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-border-default bg-panel-strong px-3 py-2">
      <span className="text-xs font-mono uppercase tracking-wide text-faint">{label}</span>
      <div className="text-right">
        <div className="text-sm text-body">{version ?? "—"}</div>
        {datetime && (
          <div className="text-[11px] text-faint">
            {new Date(datetime).toLocaleString()}
            {valid === false && <span className="ml-1 text-danger">· invalid</span>}
          </div>
        )}
      </div>
    </div>
  );
}

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "error"; message: string }
  | { status: "done"; firmwares: AvailableFirmware[] };

/** Read-only firmware status (running/default/recovery slots, per `system/status.firmware`), plus an
 *  on-demand check against the upgrade server and USB media for what else is available to install. */
export function FirmwarePanel() {
  const client = useIntinorClient();
  const { data, error } = usePolledResource<SystemStatus>("system/status", 10000);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });

  if (error && !data) {
    return (
      <div className="rounded border border-signal-red-500/40 bg-signal-red-500/10 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const f = data.firmware;
  const updateAvailable = f.running.version !== f.default.version;

  async function checkForUpdates() {
    setCheck({ status: "checking" });
    try {
      const res = await client.getAvailableFirmwares();
      setCheck({ status: "done", firmwares: res.available_firmwares });
    } catch (err) {
      setCheck({
        status: "error",
        message: err instanceof Error ? err.message : "Could not reach the upgrade server.",
      });
    }
  }

  const newer =
    check.status === "done" ? check.firmwares.filter((v) => v.version !== f.running.version) : [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium font-mono uppercase tracking-wide text-muted">Firmware</h2>
          <p className="mt-1 text-xs text-faint">
            Running, default (installed on next boot), and recovery firmware slots, from{" "}
            <code className="rounded bg-panel-hover px-1">system/status.firmware</code>. There is no
            endpoint to validate firmware integrity or swap to recovery in the API this dashboard
            was built against; only what&apos;s below is exposed.
          </p>
        </div>
        <button
          onClick={() => void checkForUpdates()}
          disabled={check.status === "checking"}
          className="shrink-0 rounded border border-border-strong px-3 py-1.5 text-xs text-body hover:bg-panel-hover disabled:opacity-50"
        >
          {check.status === "checking" ? "Checking…" : "Check for updates"}
        </button>
      </div>

      {updateAvailable && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-warning">
          Running <strong>{f.running.version}</strong> differs from default{" "}
          <strong>{f.default.version}</strong>, so an upgrade may be pending or was skipped.
        </div>
      )}

      {check.status === "checking" && (
        <p className="text-xs text-faint">
          Querying the upgrade server and USB media for candidate firmware. This can take a moment.
        </p>
      )}

      {check.status === "error" && (
        <div className="rounded border border-signal-red-500/40 bg-signal-red-500/10 px-3 py-2 text-xs text-danger">
          Couldn&apos;t check for updates: {check.message}
        </div>
      )}

      {check.status === "done" && newer.length === 0 && (
        <div className="rounded border border-border-strong bg-panel px-3 py-2 text-xs text-muted">
          Running <strong>{f.running.version}</strong> matches every firmware the upgrade server
          and USB media currently offer. Nothing to install.
        </div>
      )}

      {check.status === "done" && newer.length > 0 && (
        <div className="space-y-1.5 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <p className="text-warning">
            {newer.length} firmware version{newer.length === 1 ? "" : "s"} available that differ from
            what&apos;s running. Install one from the Danger zone below.
          </p>
          <ul className="space-y-1">
            {newer.map((v) => (
              <li
                key={`${v.source}:${v.version}`}
                className="flex items-center justify-between gap-3 rounded bg-panel-strong px-2 py-1"
              >
                <span className="font-mono text-body">{v.version}</span>
                <span className="text-faint">
                  {v.release ?? v.source}
                  {v.datetime ? ` · ${new Date(v.datetime).toLocaleDateString()}` : ""}
                </span>
              </li>
            ))}
          </ul>
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
