"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useThumbnailTick, withThumbnailTick } from "@/hooks/useThumbnailTick";
import { useOpenPipeSettings } from "@/lib/navigation/selection";
import type { VideoInput } from "@/lib/intinor/types";
import { formatBitrate, formatVideoFormat } from "@/lib/format";

/** Compact row for the dense list view — same data as VideoInputCard, laid out for scale. */
export function VideoInputRow({ index }: { index: number }) {
  const client = useIntinorClient();
  const openSettings = useOpenPipeSettings("video_input", index);
  const { data } = usePolledResource<VideoInput>(
    `video_inputs/${index}?include=settings,status,thumbnails`,
    5000,
  );
  const tick = useThumbnailTick();

  const status = data?.status;
  const bitrate = status?.netvideo_source.srt?.bitrate ?? status?.netvideo_source.rtmp_receive?.bitrate;
  const thumbId = data?.thumbnails?.thumbnails[0]?.id;
  const thumbUrl = thumbId
    ? withThumbnailTick(client.videoInputThumbnailUrl(index, thumbId, { width: 128, height: 72 }), tick)
    : null;
  const active = status?.active ?? false;
  const sourceLine = data?.settings?.netvideo_source.type
    ? data.settings.netvideo_source.type.replace(/_/g, " ").toUpperCase()
    : undefined;

  return (
    <div
      onClick={openSettings}
      title="Click to open settings"
      className="grid cursor-pointer grid-cols-[80px_1fr_1fr_auto] items-center gap-3 p-2.5 hover:bg-panel-hover"
    >
      <div className="flex h-11 w-20 items-center justify-center overflow-hidden rounded bg-slate-950">
        {thumbUrl ? (
          // Proxied API image — plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[9px] font-mono uppercase tracking-wide text-slate-600">No stream</span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={"h-1.5 w-1.5 shrink-0 rounded-full " + (active ? "bg-emerald-400" : "bg-slate-600")}
          />
          <span className="truncate text-sm text-body">{data?.description}</span>
        </div>
      </div>

      <div className="min-w-0 text-xs text-muted">
        <div className="truncate">{sourceLine ?? "—"}</div>
        {status?.video_in?.video?.format && (
          <div className="truncate text-faint">{formatVideoFormat(status.video_in.video.format)}</div>
        )}
      </div>

      <div className="text-right text-xs text-body">{formatBitrate(bitrate)}</div>
    </div>
  );
}
