"use client";

import { useEffect, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";

/**
 * Live preview of the mixer's actual composited program output, polled from
 * the unit's own thumbnail endpoint. This is what's *applied* on the unit —
 * distinct from the editing canvas, which shows unsaved edits. Bump
 * `refreshKey` to force an immediate reload right after an apply.
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

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const base = client.videoMixerThumbnailUrl(index, "program", { width: 480 });
  const src = `${base}${base.includes("?") ? "&" : "?"}_r=${tick}-${refreshKey}`;

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded border border-slate-800 bg-slate-950">
        {/* Proxied API image — plain <img> is correct here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Mixer ${index} live program output`} className="aspect-video w-full object-cover" />
      </div>
      <p className="text-xs text-slate-500">
        Live program output from the unit — reflects what&apos;s currently applied,
        not unsaved edits.
      </p>
    </div>
  );
}
