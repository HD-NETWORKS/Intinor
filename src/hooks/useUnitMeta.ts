"use client";

import { useEffect, useState } from "react";
import { useCurrentUnit } from "@/lib/units/context";

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

interface RawMeta {
  mock: boolean;
  writesAllowed: boolean;
  configured: boolean;
}

/**
 * `mock`/`writesAllowed`/`configured` come from /api/meta (global flags); the
 * unit id is overlaid from the current-unit context so it always names
 * whichever unit is actually selected, not just the server's default.
 */
export function useUnitMeta(): UnitMeta | null {
  const { unitId } = useCurrentUnit();
  const [raw, setRaw] = useState<RawMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m: RawMeta) => {
        if (!cancelled) setRaw(m);
      })
      .catch(() => {
        /* banner elsewhere reports connectivity problems */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!raw) return null;
  return { ...raw, unitId };
}
