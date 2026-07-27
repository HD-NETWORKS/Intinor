import "server-only";

/**
 * Builds a monitoring Snapshot from the unit.
 *
 * **Strictly read-only.** Every request here is a GET; the monitor never
 * writes to the unit, so the cron job carries no risk to a live broadcast
 * even when it runs unattended every minute.
 *
 * Requests go through the same proxy stack as the UI (mock mode included), so
 * `MOCK=1` produces real snapshots against mock data and the whole alerting
 * path can be exercised without the hardware.
 */

import type {
  EncodersList,
  EncoderStatus,
  NetworkInputsList,
  NetworkInputStatus,
  NetworkInterfacesList,
  StorageStatus,
  SystemStatus,
} from "../intinor/types";
import { isMockMode } from "../intinor/server/config";
import { resolveMock } from "../intinor/mock/resolve";
import { unitFetch } from "../intinor/server/unit-fetch";
import type {
  Snapshot,
  SnapshotEncoder,
  SnapshotInput,
  SnapshotInterface,
} from "./rules";

/** GET a unit path, honouring mock mode. Returns null on 404 / failure. */
async function getJson<T>(unitId: string, path: string): Promise<T | null> {
  try {
    if (isMockMode()) {
      const mock = resolveMock("GET", path);
      return mock.status === 200 ? (mock.body as T) : null;
    }
    const res = await unitFetch(unitId, path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function collectSnapshot(unitId: string): Promise<Snapshot> {
  const [system, interfaces, storage, encoderList, inputList] = await Promise.all([
    getJson<SystemStatus>(unitId, "system/status"),
    getJson<NetworkInterfacesList>(unitId, "network_interfaces"),
    getJson<StorageStatus>(unitId, "storage/status"),
    getJson<EncodersList>(unitId, "encoders"),
    getJson<NetworkInputsList>(unitId, "network_inputs"),
  ]);

  // Per-pipe status, iterating whatever the unit actually exposes.
  const encoders: SnapshotEncoder[] = await Promise.all(
    (encoderList?.encoders ?? []).map(async (enc) => {
      const status = await getJson<EncoderStatus>(unitId, `encoders/${enc.index}/status`);
      return {
        index: enc.index,
        description: enc.description ?? "",
        active: status?.active ?? enc.active ?? false,
        totalBitrate: status?.encoding?.total_bitrate ?? null,
        destinations: (status?.destinations?.basic ?? []).map((d) => ({
          id: d.id,
          bitrate: d.bitrate ?? null,
          packetLoss: d.packet_loss ?? null,
        })),
      };
    }),
  );

  const inputs: SnapshotInput[] = await Promise.all(
    (inputList?.network_inputs ?? []).map(async (input) => {
      const status = await getJson<NetworkInputStatus>(
        unitId,
        `network_inputs/${input.index}/status`,
      );
      return {
        index: input.index,
        description: input.description ?? "",
        active: status?.active ?? input.active ?? false,
        bitrate: status?.network_source?.bitrate ?? null,
        packetLoss: status?.network_source?.packet_loss ?? null,
      };
    }),
  );

  const ifaceStatuses = interfaces?.status?.status ?? [];
  const snapshotInterfaces: SnapshotInterface[] = (
    interfaces?.network_interfaces ?? []
  ).map((iface, i) => {
    const st = ifaceStatuses[i];
    const ethLink = st?.ethernet?.link;
    const cellular = st?.cellular_modem;
    return {
      name: iface.name,
      index: iface.index,
      internetAccess: st?.internet_access ?? false,
      // "Link up" means different things per media: an ethernet carrier, or a
      // connected cellular modem.
      linkUp: ethLink != null ? ethLink > 0 : (cellular?.connected ?? false),
      rxBitrate: st?.rx_bitrate ?? null,
      txBitrate: st?.tx_bitrate ?? null,
      signalStrength: cellular?.service?.simple_signal_strength ?? null,
    };
  });

  const memTotal = system?.memory?.total ?? null;
  const memAvail = system?.memory?.available ?? null;

  return {
    unitId,
    ts: new Date().toISOString(),
    cpuUsage: system?.cpu?.usage ?? null,
    memoryUsedBytes: memTotal != null && memAvail != null ? memTotal - memAvail : null,
    memoryTotalBytes: memTotal,
    batteryCharge: system?.battery?.charge ?? null,
    storagePresent: storage?.present ?? false,
    storageUsedBytes: storage?.used ?? null,
    storageSizeBytes: storage?.size ?? null,
    firmwareRunning: system?.firmware?.running?.version ?? null,
    firmwareDefault: system?.firmware?.default?.version ?? null,
    encoders,
    inputs,
    interfaces: snapshotInterfaces,
  };
}

/** Flatten a snapshot into the row shape stored in Supabase. */
export function snapshotToRow(s: Snapshot) {
  return {
    unit_id: s.unitId,
    ts: s.ts,
    cpu_usage: s.cpuUsage,
    memory_used_bytes: s.memoryUsedBytes,
    memory_total_bytes: s.memoryTotalBytes,
    battery_charge: s.batteryCharge,
    storage_used_bytes: s.storageUsedBytes,
    storage_size_bytes: s.storageSizeBytes,
    firmware_running: s.firmwareRunning,
    firmware_default: s.firmwareDefault,
    encoders: s.encoders,
    inputs: s.inputs,
    interfaces: s.interfaces,
  };
}

/** Rebuild the parts of a Snapshot the rules need from a stored row. */
export function rowToSnapshot(row: {
  unit_id: string;
  ts: string;
  cpu_usage: number | null;
  memory_used_bytes: number | null;
  memory_total_bytes: number | null;
  battery_charge: number | null;
  storage_used_bytes: number | null;
  storage_size_bytes: number | null;
  firmware_running: string | null;
  firmware_default: string | null;
  encoders: unknown;
  inputs: unknown;
  interfaces: unknown;
}): Snapshot {
  return {
    unitId: row.unit_id,
    ts: row.ts,
    cpuUsage: row.cpu_usage,
    memoryUsedBytes: row.memory_used_bytes,
    memoryTotalBytes: row.memory_total_bytes,
    batteryCharge: row.battery_charge,
    storagePresent: row.storage_size_bytes != null,
    storageUsedBytes: row.storage_used_bytes,
    storageSizeBytes: row.storage_size_bytes,
    firmwareRunning: row.firmware_running,
    firmwareDefault: row.firmware_default,
    encoders: (row.encoders as SnapshotEncoder[]) ?? [],
    inputs: (row.inputs as SnapshotInput[]) ?? [],
    interfaces: (row.interfaces as SnapshotInterface[]) ?? [],
  };
}
