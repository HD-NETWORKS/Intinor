"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type { VideoMixer } from "@/lib/intinor/types";
import { formatVideoFormat } from "@/lib/format";
import { StatusCardShell } from "../StatusCardShell";
import { Thumbnail } from "../Thumbnail";

export function VideoMixerCard({ index }: { index: number }) {
  const client = useIntinorClient();
  const { data, error, loading } = usePolledResource<VideoMixer>(
    `video_mixers/${index}?include=settings,status,thumbnails`,
    5000,
  );

  const status = data?.status;
  const video = status?.video_out.video;
  const layerCount = status?.program?.layers.length;
  const thumbId = data?.thumbnails?.thumbnails[0]?.id;

  return (
    <StatusCardShell
      title="Video mixer"
      description={data?.description}
      active={status?.active}
      loading={loading && !data}
      error={error && !data ? error : null}
      messages={status?.messages}
      stats={[
        { label: "Layers", value: layerCount != null ? String(layerCount) : undefined },
        { label: "Format", value: formatVideoFormat(video?.format) },
        { label: "Codec", value: video?.codec?.name?.toUpperCase() ?? "Raw" },
      ]}
    >
      {thumbId && (
        <Thumbnail
          alt={`Video mixer ${index} program preview`}
          urlBuilder={(opts) =>
            client.videoMixerThumbnailUrl(index, thumbId, { ppm: opts.ppm, width: 320 })
          }
        />
      )}
    </StatusCardShell>
  );
}
