"use client";

import { useState } from "react";
import { usePolledResource } from "@/hooks/usePolledResource";
import type {
  EncodersList,
  NetworkInputsList,
  VideoInputsList,
  VideoMixersList,
} from "@/lib/intinor/types";
import { SystemPanel } from "@/components/panels/SystemPanel";
import { NetworkInterfacesPanel } from "@/components/panels/NetworkInterfacesPanel";
import { NetworkInputCard } from "@/components/panels/NetworkInputCard";
import { VideoInputCard } from "@/components/panels/VideoInputCard";
import { VideoMixerCard } from "@/components/panels/VideoMixerCard";
import { EncoderCard } from "@/components/panels/EncoderCard";
import { NetworkInputRow } from "@/components/panels/NetworkInputRow";
import { VideoInputRow } from "@/components/panels/VideoInputRow";
import { EncoderRow } from "@/components/panels/EncoderRow";
import { PipeTable } from "@/components/panels/PipeTable";
import { HistoryPanel } from "@/components/history/HistoryPanel";

/** Cards read well for a handful of pipes; a dense rack unit wants the list. */
const AUTO_LIST_THRESHOLD = 8;

export default function Overview() {
  const inputs = usePolledResource<NetworkInputsList>("network_inputs", 5000);
  const videoInputs = usePolledResource<VideoInputsList>("video_inputs", 5000);
  const mixers = usePolledResource<VideoMixersList>("video_mixers", 5000);
  const encoders = usePolledResource<EncodersList>("encoders", 5000);

  const inputCount = inputs.data?.network_inputs.length ?? 0;
  const videoInputCount = videoInputs.data?.video_inputs.length ?? 0;
  const mixerCount = mixers.data?.video_mixers.length ?? 0;
  const encoderCount = encoders.data?.encoders.length ?? 0;

  // Cards read well for a handful of pipes; a dense rack unit defaults to the
  // list — but an explicit click always wins over the auto-pick.
  const [viewOverride, setViewOverride] = useState<"cards" | "list" | null>(null);
  const autoView =
    inputCount + videoInputCount + encoderCount > AUTO_LIST_THRESHOLD ? "list" : "cards";
  const effectiveView = viewOverride ?? autoView;

  const listError = inputs.error ?? videoInputs.error ?? mixers.error ?? encoders.error;
  const anyListData = inputs.data ?? videoInputs.data ?? mixers.data ?? encoders.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Unit overview</h1>
        <p className="text-sm text-slate-500">Live status — read-only. Updates every 5 seconds.</p>
      </div>

      <SystemPanel />

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Signal chain
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {inputCount} input · {videoInputCount} Netvideo · {mixerCount} mixer ·{" "}
              {encoderCount} encoder — fixed by hardware/license
            </span>
            <div className="flex gap-1">
              {(["cards", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewOverride(v)}
                  className={
                    "rounded border px-2 py-0.5 text-xs capitalize " +
                    (effectiveView === v
                      ? "border-sky-500/60 bg-sky-500/10 text-sky-300"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800")
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {listError && !anyListData ? (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {listError}
          </div>
        ) : effectiveView === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {inputs.data?.network_inputs.map((i) => (
              <NetworkInputCard key={`ni-${i.index}`} index={i.index} />
            ))}
            {videoInputs.data?.video_inputs.map((v) => (
              <VideoInputCard key={`vi-${v.index}`} index={v.index} />
            ))}
            {mixers.data?.video_mixers.map((m) => (
              <VideoMixerCard key={`vm-${m.index}`} index={m.index} />
            ))}
            {encoders.data?.encoders.map((e) => (
              <EncoderCard key={`enc-${e.index}`} index={e.index} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {mixers.data && mixers.data.video_mixers.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-3">
                {mixers.data.video_mixers.map((m) => (
                  <VideoMixerCard key={`vm-${m.index}`} index={m.index} />
                ))}
              </div>
            )}
            {inputs.data && (
              <PipeTable
                title={`Network inputs (${inputCount})`}
                items={inputs.data.network_inputs}
                emptyMessage="This unit has no network inputs."
                renderRow={(it) => <NetworkInputRow index={it.index} />}
              />
            )}
            {videoInputs.data && videoInputs.data.video_inputs.length > 0 && (
              <PipeTable
                title={`Netvideo inputs (${videoInputCount})`}
                items={videoInputs.data.video_inputs}
                emptyMessage="This unit has no Netvideo inputs."
                renderRow={(it) => <VideoInputRow index={it.index} />}
              />
            )}
            {encoders.data && (
              <PipeTable
                title={`Encoders (${encoderCount})`}
                items={encoders.data.encoders}
                emptyMessage="This unit has no encoders."
                renderRow={(it) => <EncoderRow index={it.index} />}
              />
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Pipe counts come straight from the unit&apos;s API — this dashboard manages whatever
          the hardware/license provides and cannot add encoders, mixers, or inputs.
        </p>
      </div>

      <NetworkInterfacesPanel />

      <HistoryPanel />
    </div>
  );
}
