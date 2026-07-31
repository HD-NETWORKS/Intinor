"use client";

import { useCurrentUnit } from "@/lib/units/context";
import { usePolledResource } from "@/hooks/usePolledResource";
import type { NetworkInterfacesList } from "@/lib/intinor/types";

/**
 * The unit's own live primary-interface IP — not the configured `host`
 * (which may be `iss.intinor.se`, not an IP at all, when routed through
 * Intinor's relay), and not exposed by /api/meta (that endpoint is
 * deliberately public/unauthenticated). This reads the same per-unit,
 * authenticated `network_interfaces` status NetworkInterfacesPanel already
 * shows on the Overview page, so it stays correct if the address ever
 * changes and never leaks anywhere unauthenticated.
 */
function useCurrentUnitIp(): string | null {
  const { data } = usePolledResource<NetworkInterfacesList>("network_interfaces", 10_000);
  const statuses = data?.status?.status;
  const primary = statuses?.find((s) => s.primary_interface) ?? statuses?.[0];
  return primary?.ip?.address ?? primary?.ethernet?.address ?? null;
}

/** Always shows which unit you're on and its current IP; adds a switcher dropdown once a second unit is configured. */
export function UnitSwitcher() {
  const { unitId, units, setUnitId, loading } = useCurrentUnit();
  const ip = useCurrentUnitIp();

  if (loading || !unitId) return null;

  const current = units.find((u) => u.id === unitId);
  const label = current?.label ? `${current.label} (${unitId})` : unitId;

  return (
    <div className="flex items-center gap-2">
      {units.length > 1 ? (
        <select
          value={unitId}
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
      ) : (
        <span className="text-sm font-medium text-body">{label}</span>
      )}
      {ip && (
        <span className="rounded border border-border-default px-1.5 py-0.5 font-mono text-xs text-faint">
          {ip}
        </span>
      )}
    </div>
  );
}
