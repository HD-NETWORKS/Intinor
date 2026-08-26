"use client";

import { useState } from "react";
import { useThumbnailTick, withThumbnailTick } from "@/hooks/useThumbnailTick";

/**
 * Live thumbnail preview with a PPM (audio peak-meter) overlay toggle.
 * Reloads on its own interval by cache-busting the URL — thumbnails are
 * images, not JSON, so they don't go through the ETag polling hook.
 */
export function Thumbnail({
  urlBuilder,
  alt,
  intervalMs = 10_000,
  downloadFilename,
}: {
  urlBuilder: (opts: { ppm: boolean }) => string;
  alt: string;
  intervalMs?: number;
  /** When set, shows a "Download snapshot" link that saves the current frame under this filename. */
  downloadFilename?: string;
}) {
  const [ppm, setPpm] = useState(false);
  const tick = useThumbnailTick(intervalMs);
  const src = withThumbnailTick(urlBuilder({ ppm }), tick);

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded border border-slate-800 bg-slate-950">
        {/* Proxied API image, not a static/Next-optimizable asset — plain <img> is correct here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="aspect-video w-full object-cover" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <label
          className="flex items-center gap-1.5 text-xs text-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={ppm}
            onChange={(e) => setPpm(e.target.checked)}
            className="accent-brand-500"
          />
          Audio level overlay (PPM)
        </label>
        {downloadFilename && (
          <a
            href={src}
            download={downloadFilename}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-brand-500/60 bg-brand-500/10 px-2 py-1 text-xs text-accent hover:bg-brand-500/20"
          >
            Download snapshot
          </a>
        )}
      </div>
    </div>
  );
}
