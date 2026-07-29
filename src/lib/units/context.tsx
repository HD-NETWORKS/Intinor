"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UNIT_PROXY_BASE } from "@/lib/intinor-client";

export interface UnitOption {
  id: string;
  label?: string;
}

interface UnitContextValue {
  /** Currently selected unit id, or null until /api/meta has loaded. */
  unitId: string | null;
  /** The unit routes fall back to when no unit is specified — see server/config.ts. */
  defaultUnitId: string | null;
  /** All units the server knows about (id + optional display label). */
  units: UnitOption[];
  /** Proxy base for the *selected* unit — pass straight to fetch()/createIntinorClient(). */
  base: string;
  setUnitId: (id: string) => void;
  loading: boolean;
}

const STORAGE_KEY = "intinor:selected-unit";

const UnitContext = createContext<UnitContextValue | null>(null);

/**
 * Loads the configured unit list once (from the public /api/meta) and tracks
 * which one is selected, persisted in localStorage so a reload doesn't bounce
 * back to the default. Everything that fetches unit data — usePolledResource,
 * useIntinorClient — reads `base` from here, so switching units re-points
 * every panel on the page without prop-drilling a unit id through the tree.
 */
export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [defaultUnitId, setDefaultUnitId] = useState<string | null>(null);
  const [unitId, setUnitIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/meta")
      .then((r) => r.json())
      .then((meta: { units?: UnitOption[]; unitId?: string | null }) => {
        if (cancelled) return;
        const list = meta.units ?? [];
        setUnits(list);
        setDefaultUnitId(meta.unitId ?? null);
        const stored =
          typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        const validStored = stored && list.some((u) => u.id === stored) ? stored : null;
        setUnitIdState(validStored ?? meta.unitId ?? null);
      })
      .catch(() => {
        /* ModeBanner reports connectivity problems */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setUnitId = useCallback((id: string) => {
    setUnitIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const base = useMemo(() => {
    if (!unitId || unitId === defaultUnitId) return UNIT_PROXY_BASE;
    return `/api/units/${encodeURIComponent(unitId)}`;
  }, [unitId, defaultUnitId]);

  const value = useMemo(
    () => ({ unitId, defaultUnitId, units, base, setUnitId, loading }),
    [unitId, defaultUnitId, units, base, setUnitId, loading],
  );

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useCurrentUnit(): UnitContextValue {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error("useCurrentUnit must be used within <UnitProvider>");
  return ctx;
}
