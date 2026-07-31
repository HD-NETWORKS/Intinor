"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type { VideoInput } from "@/lib/intinor/types";
import { formatBitrate, formatVideoFormat } from "@/lib/format";
import { StatusCardShell } from "../StatusCardShell";
import { Thumbnail } from "../Thumbnail";

export function VideoInputCard({ index }: { index: number }) {
  const client = useIntinorClient();
  const { data, error, loading } = usePolledResource<VideoInput>(
    `video_inputs/${index}?include=settings,status,thumbnails`,
    5000,
  );

  const status = data?.status;
  const bitrate = status?.netvideo_source.srt?.bitrate ?? status?.netvideo_source.rtmp_receive?.bitrate;
  const thumbId = data?.thumbnails?.thumbnails[0]?.id;

  return (
    <StatusCardShell
      title="Netvideo input"
      description={data?.description}
      active={status?.active}
      loading={loading && !data}
      error={error && !data ? error : null}
      messages={status?.messages}
      stats={[
        { label: "Bitrate", value: formatBitrate(bitrate) },
        { label: "Format", value: formatVideoFormat(status?.video_in?.video?.format) },
        { label: "Codec", value: status?.video_in?.video?.codec?.name?.toUpperCase() },
      ]}
    >
      {thumbId && (
        <Thumbnail
          alt={`Netvideo input ${index} preview`}
          urlBuilder={(opts) =>
            client.videoInputThumbnailUrl(index, thumbId, { ppm: opts.ppm, width: 320 })
          }
        />
      )}
    </StatusCardShell>
  );
}
