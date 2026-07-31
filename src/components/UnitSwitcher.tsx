"use client";

import { useCurrentUnit } from "@/lib/units/context";

/** Only renders once a second unit is actually configured — a no-op for the common single-unit setup. */
export function UnitSwitcher() {
  const { unitId, units, setUnitId, loading } = useCurrentUnit();

  if (loading || units.length <= 1) return null;

  return (
    <select
      value={unitId ?? ""}
      onChange={(e) => setUnitId(e.target.value)}
      className="rounded border border-border-strong bg-page px-2 py-1 text-sm text-body"
      aria-label="Select unit"
    >
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label ? `${u.label} (${u.id})` : u.id}
        </option>
      ))}
    </select>
  );
}
