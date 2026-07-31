"use client";

import { useEffect, useState } from "react";

/**
 * A counter that increments on a fixed interval, for cache-busting a raw
 * thumbnail `<img src>` — thumbnails are images, not JSON, so they don't
 * benefit from the ETag-aware polling hook and would otherwise sit on the
 * browser's cached copy forever once loaded once.
 */
export function useThumbnailTick(intervalMs = 10_000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}

/** Appends (or extends) a cache-busting query param onto a thumbnail URL. */
export function withThumbnailTick(url: string, tick: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}_r=${tick}`;
}
