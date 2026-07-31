"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useThumbnailTick, withThumbnailTick } from "@/hooks/useThumbnailTick";
import type { CommonPipeInfo, PipeThumbnails } from "@/lib/intinor/types";

export type SourceKind = "network_input" | "video_input" | "video_mixer" | "test_picture";

const KIND_LABEL: Record<SourceKind, string> = {
  network_input: "IP stream",
  video_input: "Netvideo",
  video_mixer: "Mixer",
  test_picture: "Test picture",
};

const KIND_PATH: Record<Exclude<SourceKind, "test_picture">, string> = {
  network_input: "network_inputs",
  video_input: "video_inputs",
  video_mixer: "video_mixers",
};

interface TileData extends CommonPipeInfo {
  thumbnails?: PipeThumbnails;
}

/** A draggable source tile — one network input, Netvideo input, mixer, or the static test picture. */
export function SourceTile({
  kind,
  index,
  href,
  label,
  dragDisabled,
  onDragStart,
  onDragEnd,
  usedBy,
}: {
  kind: SourceKind;
  index?: number;
  href: string;
  label: string;
  dragDisabled: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  usedBy?: string[];
}) {
  const client = useIntinorClient();
  const path = kind !== "test_picture" ? `${KIND_PATH[kind]}/${index}?include=status,thumbnails` : "";
  const { data } = usePolledResource<TileData>(path, 8000, kind !== "test_picture");
  const tick = useThumbnailTick();

  const thumbId = data?.thumbnails?.thumbnails[0]?.id;
  const rawThumbUrl =
    thumbId && index != null
      ? kind === "network_input"
        ? client.networkInputThumbnailUrl(index, thumbId, { width: 160, height: 90 })
        : kind === "video_input"
          ? client.videoInputThumbnailUrl(index, thumbId, { width: 160, height: 90 })
          : kind === "video_mixer"
            ? client.videoMixerThumbnailUrl(index, thumbId, { width: 160, height: 90 })
            : null
      : null;
  const thumbUrl = rawThumbUrl ? withThumbnailTick(rawThumbUrl, tick) : null;

  return (
    <div
      draggable={!dragDisabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", href);
        e.dataTransfer.effectAllowed = "copy";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={
        "w-40 shrink-0 space-y-1 rounded border border-slate-800 bg-slate-900/50 p-2 " +
        (dragDisabled ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing hover:border-sky-600/60")
      }
      title={dragDisabled ? "Not editable for your account" : `Drag onto an encoder to set its source`}
    >
      <div className="flex h-[90px] items-center justify-center overflow-hidden rounded bg-slate-950">
        {thumbUrl ? (
          // Proxied API image — plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-slate-600">
            {kind === "test_picture" ? "Test picture" : "No stream"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {kind !== "test_picture" && (
          <span
            className={"h-1.5 w-1.5 shrink-0 rounded-full " + (data?.active ? "bg-emerald-400" : "bg-slate-600")}
          />
        )}
        <span className="truncate text-xs text-slate-200">{label}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{KIND_LABEL[kind]}</div>
      {usedBy && usedBy.length > 0 && (
        <div className="truncate text-[10px] text-amber-400" title={`Also used by ${usedBy.join(", ")}`}>
          ⚠ used by {usedBy.join(", ")}
        </div>
      )}
    </div>
  );
}
