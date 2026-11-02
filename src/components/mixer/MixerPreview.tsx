"use client";

import { useEffect, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { usePolledResource } from "@/hooks/usePolledResource";
import type { VideoMixer } from "@/lib/intinor/types";

/**
 * Live preview of the mixer's actual composited program output, polled from
 * the unit's own thumbnail endpoint. This is what's *applied* on the unit —
 * distinct from the editing canvas, which shows unsaved edits. Bump
 * `refreshKey` to force an immediate reload right after an apply.
 *
 * The unit only exposes a "program" thumbnail once the mixer actually has
 * composited content (no layers with a live source yet means an empty
 * `thumbnails.thumbnails[]` and a 400 on the thumbnail endpoint itself) — so
 * this checks presence the same way every other thumbnail in this app does,
 * instead of requesting an id that may not exist yet.
 */
export function MixerPreview({
  index,
  refreshKey = 0,
  intervalMs = 5000,
}: {
  index: number;
  refreshKey?: number;
  intervalMs?: number;
}) {
  const [tick, setTick] = useState(0);
  const client = useIntinorClient();
  const { data } = usePolledResource<VideoMixer>(
    `video_mixers/${index}?include=thumbnails`,
    intervalMs,
  );
  const hasThumbnail = (data?.thumbnails?.thumbnails?.length ?? 0) > 0;

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const base = client.videoMixerThumbnailUrl(index, "program", { width: 480 });
  const src = `${base}${base.includes("?") ? "&" : "?"}_r=${tick}-${refreshKey}`;

  return (
    <div className="space-y-1.5">
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded border border-slate-800 bg-slate-950">
        {hasThumbnail ? (
          // Proxied API image — plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Mixer ${index} live program output`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-wide text-slate-600">
            No program output
          </span>
        )}
      </div>
      <p className="text-xs text-faint">
        Live program output from the unit. Reflects what&apos;s currently applied,
        not unsaved edits.
      </p>
    </div>
  );
}
