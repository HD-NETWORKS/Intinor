"use client";

import { useEffect, useState } from "react";

/**
 * Live thumbnail preview with a PPM (audio peak-meter) overlay toggle.
 * Reloads on its own interval by cache-busting the URL — thumbnails are
 * images, not JSON, so they don't go through the ETag polling hook.
 */
export function Thumbnail({
  urlBuilder,
  alt,
  intervalMs = 10_000,
}: {
  urlBuilder: (opts: { ppm: boolean }) => string;
  alt: string;
  intervalMs?: number;
}) {
  const [ppm, setPpm] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const base = urlBuilder({ ppm });
  const src = `${base}${base.includes("?") ? "&" : "?"}_r=${tick}`;

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded border border-slate-800 bg-slate-950">
        {/* Proxied API image, not a static/Next-optimizable asset — plain <img> is correct here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="aspect-video w-full object-cover" />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={ppm}
          onChange={(e) => setPpm(e.target.checked)}
          className="accent-sky-500"
        />
        Audio level overlay (PPM)
      </label>
    </div>
  );
}
