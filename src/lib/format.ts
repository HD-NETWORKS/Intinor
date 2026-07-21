import type { VideoFormat } from "./intinor/types";

export function formatBitrate(bitsPerSecond?: number | null): string {
  if (bitsPerSecond == null) return "—";
  if (bitsPerSecond >= 1_000_000) return `${(bitsPerSecond / 1_000_000).toFixed(2)} Mbit/s`;
  if (bitsPerSecond >= 1_000) return `${(bitsPerSecond / 1_000).toFixed(0)} kbit/s`;
  return `${bitsPerSecond} bit/s`;
}

export function formatVideoFormat(f?: VideoFormat | null): string {
  if (!f) return "—";
  return `${f.width}×${f.height}${f.interlaced ? "i" : "p"}/${f.framerate}`;
}

export function formatPercent(value?: number | null, digits = 0): string {
  if (value == null) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatBytes(bytes?: number | null): string {
  if (bytes == null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export function formatPacketLoss(value?: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}
