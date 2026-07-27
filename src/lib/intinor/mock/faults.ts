/**
 * Fault injection for mock mode.
 *
 * Alerting is the one feature you cannot check by looking at it — you find out
 * whether it works the night a stream drops. `MOCK_FAULT` makes each condition
 * reproducible on demand, so the rules, the notification channels and the
 * anti-spam behaviour can all be exercised end to end before anyone relies on
 * them.
 *
 * Comma-separated, any of:
 *   stream_down  — encoder + input report 0 bit/s while still active
 *   firmware     — recommended firmware differs from the running version
 *   storage_full — storage reports 96% used
 *   link_loss    — the primary interface loses carrier and internet
 *
 *   MOCK=1 MOCK_FAULT=stream_down npm run dev
 */

import type {
  EncoderStatus,
  NetworkInputStatus,
  NetworkInterfacesList,
  StorageStatus,
  SystemStatus,
} from "../types";

export type FaultName = "stream_down" | "firmware" | "storage_full" | "link_loss";

export function activeFaults(): Set<FaultName> {
  const raw = process.env.MOCK_FAULT ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is FaultName =>
        ["stream_down", "firmware", "storage_full", "link_loss"].includes(s),
      ),
  );
}

export function faultEncoderStatus(status: EncoderStatus): EncoderStatus {
  if (!activeFaults().has("stream_down")) return status;
  return {
    ...status,
    encoding: { ...status.encoding, total_bitrate: 0 },
    destinations: {
      ...status.destinations,
      basic: status.destinations.basic.map((d) => ({ ...d, bitrate: 0 })),
    },
  };
}

export function faultInputStatus(status: NetworkInputStatus): NetworkInputStatus {
  if (!activeFaults().has("stream_down")) return status;
  return {
    ...status,
    network_source: { ...status.network_source, bitrate: 0 },
  };
}

export function faultSystemStatus(status: SystemStatus): SystemStatus {
  if (!activeFaults().has("firmware")) return status;
  return {
    ...status,
    firmware: {
      ...status.firmware,
      default: { ...status.firmware.default, version: "S5.4.0-1" },
    },
  };
}

/** The mock has no storage device by default; the fault gives it a full one. */
export function faultStorageStatus(status: StorageStatus | null): StorageStatus | null {
  if (!activeFaults().has("storage_full")) return status;
  const size = 512 * 1024 ** 3;
  return {
    ...(status ?? { present: true, removable: false }),
    present: true,
    removable: false,
    size,
    used: Math.round(size * 0.96),
    file_system: "ext4",
  };
}

export function faultInterfaces(list: NetworkInterfacesList): NetworkInterfacesList {
  if (!activeFaults().has("link_loss") || !list.status) return list;
  return {
    ...list,
    status: {
      ...list.status,
      status: list.status.status.map((iface, i) =>
        i === 0
          ? {
              ...iface,
              internet_access: false,
              rx_bitrate: 0,
              tx_bitrate: 0,
              ethernet: iface.ethernet ? { ...iface.ethernet, link: 0 } : undefined,
            }
          : iface,
      ),
    },
  };
}
