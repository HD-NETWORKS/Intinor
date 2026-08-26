"use client";

import { useEffect, useState } from "react";
import { useCurrentUnit } from "@/lib/units/context";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type { AvailableFirmware } from "@/lib/intinor/types";

interface Meta {
  mock: boolean;
  destructiveActionsAllowed: boolean;
}

interface ActionDef {
  action: string;
  label: string;
  severity: "medium" | "high" | "critical";
  description: string;
}

const ACTIONS: ActionDef[] = [
  {
    action: "restart_streams",
    label: "Restart streams",
    severity: "medium",
    description:
      "Restarts every encoder and input pipe without a full reboot. Briefly interrupts all active streams.",
  },
  {
    action: "upgrade_firmware",
    label: "Upgrade firmware",
    severity: "high",
    description:
      "Installs a firmware version and reboots to apply it. Defaults to the unit's own recommended choice, or pick a specific version/channel below.",
  },
  {
    action: "reboot",
    label: "Reboot unit",
    severity: "high",
    description:
      "Reboots the entire unit. All active streams drop and reconnect once it's back — typically 60–120 seconds.",
  },
  {
    action: "power_cycle",
    label: "Power cycle",
    severity: "critical",
    description: "Cuts and restores power at the hardware level. Use only if a normal reboot doesn't recover the unit.",
  },
  {
    action: "shutdown",
    label: "Shut down",
    severity: "critical",
    description:
      "Powers the unit off. It stays off until someone power-cycles it locally — nothing here can turn it back on remotely.",
  },
];

const SEVERITY_STYLE: Record<ActionDef["severity"], string> = {
  medium: "border-amber-500/40 bg-amber-500/5",
  high: "border-orange-500/40 bg-orange-500/5",
  critical: "border-signal-red-500/50 bg-signal-red-500/5",
};

const SEVERITY_BADGE: Record<ActionDef["severity"], string> = {
  medium: "bg-amber-500/15 text-warning",
  high: "bg-orange-500/15 text-warning",
  critical: "bg-signal-red-500/15 text-danger",
};

export function DangerZone() {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium font-mono uppercase tracking-wide text-danger">Danger zone</h2>
        <p className="mt-1 text-xs text-faint">
          Whole-unit maintenance actions — separate from every other control in this dashboard.
          Each one requires typing its name to confirm, and none of it is reachable unless{" "}
          <code className="rounded bg-panel-hover px-1">INTINOR_ALLOW_DESTRUCTIVE_ACTIONS=1</code> is
          set on the server, independently of routine write access.
        </p>
      </div>

      {meta && !meta.destructiveActionsAllowed && (
        <div className="rounded border border-border-strong bg-panel px-3 py-2 text-xs text-muted">
          Disabled by server config — these buttons are shown but will be refused until{" "}
          <code className="rounded bg-panel-hover px-1">INTINOR_ALLOW_DESTRUCTIVE_ACTIONS=1</code> is
          set.
        </div>
      )}

      <div className="space-y-3">
        {ACTIONS.map((a) => (
          <ActionCard key={a.action} def={a} />
        ))}
      </div>
    </section>
  );
}

function ActionCard({ def }: { def: ActionDef }) {
  const { unitId, defaultUnitId } = useCurrentUnit();
  const client = useIntinorClient();
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const isFirmwareUpgrade = def.action === "upgrade_firmware";
  const [firmwares, setFirmwares] = useState<AvailableFirmware[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!isFirmwareUpgrade) return;
    let cancelled = false;
    client
      .getAvailableFirmwares()
      .then((r) => {
        if (!cancelled) setFirmwares(r.available_firmwares);
      })
      .catch(() => {
        if (!cancelled) setFirmwares([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isFirmwareUpgrade, client]);

  const expected = def.action.toUpperCase();
  const canConfirm = typed === expected && !busy;

  // The default unit keeps the shorter /api/system-actions path; any other
  // configured unit gets its own /api/units/{id}/system-actions — same
  // two-gate design either way (see server/system-actions.ts).
  const endpoint =
    unitId && unitId !== defaultUnitId
      ? `/api/units/${encodeURIComponent(unitId)}/system-actions`
      : "/api/system-actions";

  async function run() {
    setBusy(true);
    setResult(null);
    const chosen = firmwares.find((f) => `${f.source}:${f.version}` === selected);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: def.action,
          confirm: typed,
          ...(chosen ? { version: chosen.version, source: chosen.source } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ ok: true, message: body.message ?? "Accepted." });
        setRevealed(false);
        setTyped("");
      } else {
        setResult({ ok: false, message: body.message ?? `Failed (HTTP ${res.status}).` });
      }
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded border p-4 ${SEVERITY_STYLE[def.severity]}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-fg">{def.label}</h3>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide ${SEVERITY_BADGE[def.severity]}`}>
              {def.severity}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted">{def.description}</p>
        </div>

        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="shrink-0 rounded border border-border-strong px-3 py-1.5 text-sm text-body hover:bg-panel-hover"
          >
            {def.label}…
          </button>
        )}
      </div>

      {revealed && (
        <div className="mt-3 space-y-2 border-t border-border-default pt-3">
          {isFirmwareUpgrade && (
            <div className="space-y-1">
              <label className="text-xs text-muted">Version</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded border border-border-strong bg-page px-2 py-1.5 text-sm text-body"
              >
                <option value="">Recommended default (unit&apos;s own choice)</option>
                {firmwares.map((f) => (
                  <option key={`${f.source}:${f.version}`} value={`${f.source}:${f.version}`}>
                    {f.version} — {f.release ?? f.source}
                    {f.datetime ? ` (${new Date(f.datetime).toLocaleDateString()})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-danger">
            Type <code className="rounded bg-panel-hover px-1">{expected}</code> to confirm
            {unitId ? ` on ${unitId}` : ""}.
          </p>
          <div className="flex gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={expected}
              autoFocus
              className="w-48 rounded border border-border-strong bg-page px-2 py-1.5 text-sm text-body"
            />
            <button
              onClick={run}
              disabled={!canConfirm}
              className="rounded bg-signal-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-signal-red-500 disabled:opacity-40"
            >
              {busy ? "Running…" : "Confirm"}
            </button>
            <button
              onClick={() => {
                setRevealed(false);
                setTyped("");
              }}
              disabled={busy}
              className="rounded border border-border-strong px-3 py-1.5 text-sm text-body hover:bg-panel-hover disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-success" : "text-danger"}`}>
          {result.ok ? "✓" : "✗"} {result.message}
        </p>
      )}
    </div>
  );
}
