"use client";

import { useEffect, useState } from "react";

interface Meta {
  mock: boolean;
  writesAllowed: boolean;
  unitId: string | null;
  configured: boolean;
}

/**
 * Always-visible strip showing which mode the dashboard is in, so mock data
 * can never be mistaken for the live unit — and live-write mode never goes
 * unnoticed.
 */
export function ModeBanner() {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  if (!meta) return null;

  if (meta.mock) {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500/40 px-6 py-1.5 text-sm text-amber-300">
        <strong>Mock mode</strong> — showing fake data ({meta.unitId}). No
        requests reach the real unit.
      </div>
    );
  }

  if (!meta.configured) {
    return (
      <div className="bg-red-500/15 border-b border-red-500/40 px-6 py-1.5 text-sm text-red-300">
        <strong>Not configured</strong> — set INTINOR_* variables in .env.local
        or enable MOCK=1.
      </div>
    );
  }

  return (
    <div
      className={
        meta.writesAllowed
          ? "bg-red-500/15 border-b border-red-500/40 px-6 py-1.5 text-sm text-red-300"
          : "bg-sky-500/10 border-b border-sky-500/30 px-6 py-1.5 text-sm text-sky-300"
      }
    >
      {meta.writesAllowed ? (
        <>
          <strong>Live unit {meta.unitId} — WRITES ENABLED.</strong> Changes
          affect the real broadcast chain.
        </>
      ) : (
        <>
          <strong>Live unit {meta.unitId}</strong> — read-only mode. All writes
          are blocked by the proxy.
        </>
      )}
    </div>
  );
}
