"use client";

import { useEffect, useState } from "react";
import { useCurrentUnit } from "@/lib/units/context";

interface Meta {
  mock: boolean;
  writesAllowed: boolean;
  destructiveActionsAllowed: boolean;
  configured: boolean;
  authDisabled: boolean;
  authConfigured: boolean;
}

/**
 * Always-visible strip showing which mode the dashboard is in, so mock data
 * can never be mistaken for the live unit — and live-write mode never goes
 * unnoticed. Unit id/label reflect whichever unit is currently selected (see
 * UnitProvider) rather than always the default, so switching units is
 * reflected here too.
 */
export function ModeBanner() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const { unitId, units } = useCurrentUnit();

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  if (!meta) return null;

  const current = units.find((u) => u.id === unitId);
  const unitLabel = current?.label ? `${current.label} (${current.id})` : (unitId ?? "—");

  const authWarning = meta.authDisabled ? (
    <div className="bg-red-500/15 border-b border-red-500/40 px-6 py-1.5 text-sm text-red-300">
      <strong>DASHBOARD_AUTH_DISABLED=1</strong> — no login gate. Local dev only; never set this
      on a deployment reachable from the internet.
    </div>
  ) : null;

  if (meta.mock) {
    return (
      <>
        {authWarning}
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-6 py-1.5 text-sm text-amber-300">
          <strong>Mock mode</strong> — showing fake data ({unitLabel}). No requests reach a real
          unit.
        </div>
      </>
    );
  }

  if (!meta.configured) {
    return (
      <>
        {authWarning}
        <div className="bg-red-500/15 border-b border-red-500/40 px-6 py-1.5 text-sm text-red-300">
          <strong>Not configured</strong> — set INTINOR_* variables in .env.local
          or enable MOCK=1.
        </div>
      </>
    );
  }

  return (
    <>
      {authWarning}
      <div
        className={
          meta.writesAllowed
            ? "bg-red-500/15 border-b border-red-500/40 px-6 py-1.5 text-sm text-red-300"
            : "bg-sky-500/10 border-b border-sky-500/30 px-6 py-1.5 text-sm text-sky-300"
        }
      >
        {meta.writesAllowed ? (
          <>
            <strong>Live unit {unitLabel} — WRITES ENABLED.</strong> Changes affect the real
            broadcast chain.
          </>
        ) : (
          <>
            <strong>Live unit {unitLabel}</strong> — read-only mode. All writes are blocked by the
            proxy.
          </>
        )}
      </div>
    </>
  );
}
