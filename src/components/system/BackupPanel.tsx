"use client";

import { useCallback, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useCurrentUnit } from "@/lib/units/context";

/**
 * "Save backup" only — `GET /system/config` is a plain read, unlike restoring
 * one (`PUT /system/config`), which reboots the unit and stays permanently
 * blocked by the proxy (see server/guard.ts). No danger-zone gate needed here.
 */
export function BackupPanel() {
  const client = useIntinorClient();
  const { unitId } = useCurrentUnit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const xml = await client.getSystemConfigBackup();
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${unitId ?? "unit"}-backup-${new Date().toISOString().slice(0, 10)}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }, [client, unitId]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium font-mono uppercase tracking-wide text-muted">
          Settings backup
        </h2>
        <p className="mt-1 text-xs text-faint">
          Downloads the unit&apos;s full settings snapshot (<code className="rounded bg-panel-hover px-1">GET system/config</code>,
          an XML file). Restoring one is intentionally not available here — it{"'"}s a
          destructive write that reboots the unit and this dashboard permanently blocks it at
          the proxy; use the unit&apos;s own IDM console for that.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void download()}
          disabled={busy}
          className="rounded border border-border-strong px-3 py-1.5 text-sm text-body hover:bg-panel-hover disabled:opacity-40"
        >
          {busy ? "Downloading…" : "Download backup"}
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </section>
  );
}
