"use client";

import { useEffect, useState } from "react";

export interface UnitMeta {
  mock: boolean;
  writesAllowed: boolean;
  unitId: string | null;
  configured: boolean;
}

/** Write-mode of the dashboard, used to gate every settings save. */
export type WriteMode = "mock" | "live-readonly" | "live-write" | "loading";

export function writeModeOf(meta: UnitMeta | null): WriteMode {
  if (!meta) return "loading";
  if (meta.mock) return "mock";
  return meta.writesAllowed ? "live-write" : "live-readonly";
}

export function useUnitMeta(): UnitMeta | null {
  const [meta, setMeta] = useState<UnitMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m: UnitMeta) => {
        if (!cancelled) setMeta(m);
      })
      .catch(() => {
        /* banner elsewhere reports connectivity problems */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return meta;
}
