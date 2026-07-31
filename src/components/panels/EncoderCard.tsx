"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type { Encoder } from "@/lib/intinor/types";
import { formatBitrate, formatVideoFormat } from "@/lib/format";
import { StatusCardShell } from "../StatusCardShell";
import { Thumbnail } from "../Thumbnail";

export function EncoderCard({ index }: { index: number }) {
  const client = useIntinorClient();
  const { data, error, loading } = usePolledResource<Encoder>(
    `encoders/${index}?include=settings,status,thumbnails`,
    5000,
  );

  const status = data?.status;
  const video = status?.encoding.video;
  const thumbId = data?.thumbnails?.thumbnails[0]?.id;

  return (
    <StatusCardShell
      title="Encoder"
      description={data?.description}
      active={status?.active}
      loading={loading && !data}
      error={error && !data ? error : null}
      messages={status?.messages}
      stats={[
        { label: "Bitrate", value: formatBitrate(status?.encoding.total_bitrate) },
        { label: "Format", value: formatVideoFormat(video?.format) },
        { label: "Codec", value: video?.codec?.name?.toUpperCase() },
      ]}
    >
      {thumbId && (
        <Thumbnail
          alt={`Encoder ${index} output preview`}
          urlBuilder={(opts) =>
            client.encoderThumbnailUrl(index, thumbId, { ppm: opts.ppm, width: 320 })
          }
        />
      )}
    </StatusCardShell>
  );
}
