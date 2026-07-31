"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type { NetworkInput } from "@/lib/intinor/types";
import { formatBitrate, formatVideoFormat } from "@/lib/format";
import { StatusCardShell } from "../StatusCardShell";
import { Thumbnail } from "../Thumbnail";

export function NetworkInputCard({ index }: { index: number }) {
  const client = useIntinorClient();
  const { data, error, loading } = usePolledResource<NetworkInput>(
    `network_inputs/${index}?include=settings,status,thumbnails`,
    5000,
  );

  const status = data?.status;
  const program = status?.network_source.programs[0];
  const thumbId = data?.thumbnails?.thumbnails[0]?.id;

  return (
    <StatusCardShell
      title="Network input"
      description={data?.description}
      active={status?.active}
      loading={loading && !data}
      error={error && !data ? error : null}
      messages={status?.messages}
      stats={[
        { label: "Bitrate", value: formatBitrate(status?.network_source.bitrate) },
        { label: "Format", value: formatVideoFormat(program?.video?.format) },
        { label: "Codec", value: program?.video?.codec?.name?.toUpperCase() },
      ]}
    >
      {thumbId && (
        <Thumbnail
          alt={`Network input ${index} preview`}
          urlBuilder={(opts) =>
            client.networkInputThumbnailUrl(index, thumbId, { ppm: opts.ppm, width: 320 })
          }
        />
      )}
    </StatusCardShell>
  );
}
