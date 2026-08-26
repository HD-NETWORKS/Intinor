"use client";

import { useState } from "react";
import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useThumbnailTick, withThumbnailTick } from "@/hooks/useThumbnailTick";
import { useOpenPipeSettings } from "@/lib/navigation/selection";
import type { Encoder } from "@/lib/intinor/types";

/** A drop target — one encoder. Dropping a source tile onto it proposes reassigning its video source. */
export function EncoderDestTile({
  index,
  sourceLabel,
  dropDisabled,
  isDragActive,
  onDrop,
}: {
  index: number;
  sourceLabel: string;
  dropDisabled: boolean;
  /** True while any source tile is being dragged, so drop targets can highlight even before hover. */
  isDragActive: boolean;
  onDrop: (href: string) => void;
}) {
  const client = useIntinorClient();
  const openSettings = useOpenPipeSettings("encoder", index);
  const { data } = usePolledResource<Encoder>(
    `encoders/${index}?include=settings,status,thumbnails`,
    8000,
  );
  const tick = useThumbnailTick();
  const [isOver, setIsOver] = useState(false);

  const thumbId = data?.thumbnails?.thumbnails[0]?.id;
  const thumbUrl = thumbId
    ? withThumbnailTick(client.encoderThumbnailUrl(index, thumbId, { width: 200, height: 112 }), tick)
    : null;

  const activeDestinations = [
    ...(data?.settings?.destinations.basic ?? []),
    ...(data?.settings?.destinations.rtmp ?? []),
  ].filter((d) => d.active);
  const destinationLabel =
    activeDestinations.length === 0
      ? "—"
      : activeDestinations.length === 1
        ? activeDestinations[0].description
        : `${activeDestinations[0].description} +${activeDestinations.length - 1} more`;

  return (
    <div
      onDragOver={(e) => {
        if (dropDisabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        if (dropDisabled) return;
        const href = e.dataTransfer.getData("text/plain");
        if (href) onDrop(href);
      }}
      onClick={openSettings}
      title="Open this encoder's settings"
      className={
        "w-48 shrink-0 cursor-pointer space-y-1 rounded border-2 p-2 transition-colors " +
        (isOver
          ? "border-brand-400 bg-brand-500/10"
          : isDragActive && !dropDisabled
            ? "border-dashed border-brand-700 bg-panel"
            : "border-border-default bg-panel hover:border-brand-600/60")
      }
    >
      <div className="flex h-[112px] items-center justify-center overflow-hidden rounded bg-slate-950">
        {thumbUrl ? (
          // Proxied API image — plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-wide text-slate-600">No stream</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={"h-1.5 w-1.5 shrink-0 rounded-full " + (data?.active ? "bg-emerald-400" : "bg-slate-600")}
        />
        <span className="truncate text-sm text-body">{data?.description}</span>
      </div>
      <div className="truncate text-[11px] text-faint">Source: {sourceLabel || "—"}</div>
      <div className="truncate text-[11px] text-faint">Destination: {destinationLabel}</div>
      {dropDisabled && (
        <div className="text-[10px] text-subtle">Source not editable for your account</div>
      )}
    </div>
  );
}
