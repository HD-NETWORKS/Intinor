"use client";

import { useState } from "react";
import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
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
  const { data } = usePolledResource<Encoder>(
    `encoders/${index}?include=settings,status,thumbnails`,
    8000,
  );
  const [isOver, setIsOver] = useState(false);

  const thumbId = data?.thumbnails?.thumbnails[0]?.id;
  const thumbUrl = thumbId
    ? client.encoderThumbnailUrl(index, thumbId, { width: 200, height: 112 })
    : null;

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
      className={
        "w-48 shrink-0 space-y-1 rounded border-2 p-2 transition-colors " +
        (isOver
          ? "border-sky-400 bg-sky-500/10"
          : isDragActive && !dropDisabled
            ? "border-dashed border-sky-700 bg-slate-900/50"
            : "border-slate-800 bg-slate-900/50")
      }
    >
      <div className="flex h-[112px] items-center justify-center overflow-hidden rounded bg-slate-950">
        {thumbUrl ? (
          // Proxied API image — plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-slate-600">No stream</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={"h-1.5 w-1.5 shrink-0 rounded-full " + (data?.active ? "bg-emerald-400" : "bg-slate-600")}
        />
        <span className="truncate text-sm text-slate-200">
          #{index} {data?.description}
        </span>
      </div>
      <div className="truncate text-[11px] text-slate-500">Source: {sourceLabel || "—"}</div>
      {dropDisabled && (
        <div className="text-[10px] text-slate-600">Source not editable for your account</div>
      )}
    </div>
  );
}
