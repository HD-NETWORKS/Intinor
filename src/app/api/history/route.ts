/**
 * History for the dashboard charts.
 *
 * Reads the samples the cron job stored and shapes them into chart-ready
 * series. The browser never talks to Supabase directly — the service-role key
 * stays server-side, and this route is the only read path.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchRecentAlerts,
  fetchSamples,
  isConfigured,
  type MonitorSample,
} from "@/lib/monitor/store";
import type { SnapshotEncoder, SnapshotInput, SnapshotInterface } from "@/lib/monitor/rules";

export const dynamic = "force-dynamic";

export interface HistoryPoint {
  ts: string;
  cpu: number | null;
  memoryPct: number | null;
  storagePct: number | null;
  /** Summed encoder output across all encoders, bit/s. */
  encoderBitrate: number | null;
  /** Summed network-input ingest across all inputs, bit/s. */
  inputBitrate: number | null;
  /** Worst packet loss seen on ingest / egress this sample, percent. */
  inputPacketLoss: number | null;
  egressPacketLoss: number | null;
  /** Per-interface tx bitrate, keyed by interface name. */
  interfaceTx: Record<string, number | null>;
  /** Cellular signal strength where reported, keyed by interface name. */
  signal: Record<string, number | null>;
}

function sum(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

/** Worst case, not average — one bad path is the story on a bonded link. */
function worst(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  return present.length ? Math.max(...present) : null;
}

function toPoint(row: MonitorSample): HistoryPoint {
  const encoders = (row.encoders as SnapshotEncoder[]) ?? [];
  const inputs = (row.inputs as SnapshotInput[]) ?? [];
  const interfaces = (row.interfaces as SnapshotInterface[]) ?? [];

  const interfaceTx: Record<string, number | null> = {};
  const signal: Record<string, number | null> = {};
  for (const iface of interfaces) {
    interfaceTx[iface.name] = iface.txBitrate ?? null;
    if (iface.signalStrength != null) signal[iface.name] = iface.signalStrength;
  }

  return {
    ts: row.ts,
    cpu: row.cpu_usage,
    memoryPct:
      row.memory_used_bytes != null && row.memory_total_bytes
        ? (row.memory_used_bytes / row.memory_total_bytes) * 100
        : null,
    storagePct:
      row.storage_used_bytes != null && row.storage_size_bytes
        ? (row.storage_used_bytes / row.storage_size_bytes) * 100
        : null,
    encoderBitrate: sum(encoders.map((e) => e.totalBitrate)),
    inputBitrate: sum(inputs.map((i) => i.bitrate)),
    inputPacketLoss: worst(inputs.map((i) => i.packetLoss)),
    egressPacketLoss: worst(
      encoders.flatMap((e) => e.destinations.map((d) => d.packetLoss)),
    ),
    interfaceTx,
    signal,
  };
}

export async function GET(req: NextRequest) {
  const unitId = process.env.INTINOR_UNIT_ID ?? "D01393";

  if (!isConfigured()) {
    return NextResponse.json({
      configured: false,
      unitId,
      points: [],
      alerts: [],
      message:
        "History storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and run supabase/schema.sql.",
    });
  }

  const hours = Math.min(Math.max(Number(req.nextUrl.searchParams.get("hours")) || 24, 1), 168);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  try {
    const [samples, alerts] = await Promise.all([
      fetchSamples(unitId, since),
      fetchRecentAlerts(unitId, since),
    ]);
    return NextResponse.json({
      configured: true,
      unitId,
      hours,
      from: since,
      points: samples.map(toPoint),
      alerts,
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        unitId,
        points: [],
        alerts: [],
        error: err instanceof Error ? err.message : "History query failed",
      },
      { status: 502 },
    );
  }
}
