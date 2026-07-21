"use client";

import { usePolledResource } from "@/hooks/usePolledResource";
import type { EncodersList, NetworkInputsList, VideoMixersList } from "@/lib/intinor/types";
import { SystemPanel } from "@/components/panels/SystemPanel";
import { NetworkInterfacesPanel } from "@/components/panels/NetworkInterfacesPanel";
import { NetworkInputCard } from "@/components/panels/NetworkInputCard";
import { VideoMixerCard } from "@/components/panels/VideoMixerCard";
import { EncoderCard } from "@/components/panels/EncoderCard";

export default function Overview() {
  const inputs = usePolledResource<NetworkInputsList>("network_inputs", 5000);
  const mixers = usePolledResource<VideoMixersList>("video_mixers", 5000);
  const encoders = usePolledResource<EncodersList>("encoders", 5000);

  const inputCount = inputs.data?.network_inputs.length ?? 0;
  const mixerCount = mixers.data?.video_mixers.length ?? 0;
  const encoderCount = encoders.data?.encoders.length ?? 0;

  const listError = inputs.error ?? mixers.error ?? encoders.error;
  const anyListData = inputs.data ?? mixers.data ?? encoders.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Unit overview</h1>
        <p className="text-sm text-slate-500">Live status — read-only. Updates every 5 seconds.</p>
      </div>

      <SystemPanel />

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Signal chain
          </h2>
          <span className="text-xs text-slate-500">
            {inputCount} input · {mixerCount} mixer · {encoderCount} encoder — fixed by
            hardware/license
          </span>
        </div>

        {listError && !anyListData ? (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {listError}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {inputs.data?.network_inputs.map((i) => (
              <NetworkInputCard key={`ni-${i.index}`} index={i.index} />
            ))}
            {mixers.data?.video_mixers.map((m) => (
              <VideoMixerCard key={`vm-${m.index}`} index={m.index} />
            ))}
            {encoders.data?.encoders.map((e) => (
              <EncoderCard key={`enc-${e.index}`} index={e.index} />
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Pipe counts come straight from the unit&apos;s API — this dashboard manages whatever
          the hardware/license provides and cannot add encoders, mixers, or inputs. Additional
          units (via ISS) will appear here when configured.
        </p>
      </div>

      <NetworkInterfacesPanel />
    </div>
  );
}
