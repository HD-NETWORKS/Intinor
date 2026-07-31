"use client";

import { useCallback, useEffect, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type {
  RequestMetadata,
  VideoInputsList,
  VideoInputSettings,
  VideoInputSettingsResponse,
} from "@/lib/intinor/types";
import type { FieldSection } from "@/lib/settings/fields";
import { optionsFromDescribed } from "@/lib/settings/options";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { useUnitMeta } from "@/hooks/useUnitMeta";
import { useSelectionHandoff } from "@/lib/navigation/selection";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { PipePicker } from "@/components/settings/PipePicker";

/** `_constraints.netvideo_source` is loosely typed beyond `type`; narrow just what we read. */
interface NetvideoSourceConstraints {
  network_interface?: { value?: string; description?: string }[];
}

function netvideoSections(s: VideoInputSettingsResponse): FieldSection[] {
  const c = (s._constraints?.netvideo_source ?? {}) as NetvideoSourceConstraints;
  const src = s.netvideo_source;
  const typeOptions = optionsFromDescribed(s._constraints?.netvideo_source?.type);
  const ifaceOptions = optionsFromDescribed(c.network_interface);

  const sections: FieldSection[] = [
    {
      title: "Input",
      fields: [
        { path: "description", label: "Description", kind: "text" },
        { path: "active", label: "Input active", kind: "checkbox" },
        {
          path: "netvideo_source.type",
          label: "Source type",
          kind: "select",
          options: typeOptions,
        },
      ],
    },
  ];

  if (src.srt_listener) {
    sections.push({
      title: "SRT listener",
      description: "The unit waits for an incoming connection on this port.",
      fields: [
        {
          path: "netvideo_source.srt_listener.port",
          label: "Listen port",
          kind: "number",
          min: 1,
          max: 65535,
        },
        {
          path: "netvideo_source.srt_listener.latency",
          label: "Latency",
          kind: "number",
          unit: "ms",
          min: 20,
        },
        {
          path: "netvideo_source.srt_listener.password",
          label: "Passphrase",
          kind: "password",
          help: "Leave unchanged to keep the current passphrase.",
        },
        ...(ifaceOptions.length > 0
          ? [
              {
                path: "netvideo_source.srt_listener.adapter",
                label: "Interface",
                kind: "select" as const,
                options: ifaceOptions,
              },
            ]
          : []),
      ],
    });
  }

  if (src.rtsp_pull) {
    sections.push({
      title: "RTSP (pull)",
      description: "This unit connects out to a remote RTSP server.",
      fields: [{ path: "netvideo_source.rtsp_pull.url", label: "URL", kind: "text" }],
    });
  }

  if (src.hls) {
    sections.push({
      title: "HLS (pull)",
      description: "This unit connects out to a remote HLS playlist.",
      fields: [{ path: "netvideo_source.hls.url", label: "URL", kind: "text" }],
    });
  }

  if (src.ndi) {
    sections.push({
      title: "NDI",
      fields: [
        { path: "netvideo_source.ndi.source", label: "NDI source", kind: "text" },
        {
          path: "netvideo_source.ndi.audio_gain",
          label: "Audio gain",
          kind: "number",
          unit: "dB",
        },
      ],
    });
  }

  if (src.srt_caller) {
    sections.push({
      title: "SRT caller",
      description: "The unit dials out to a remote SRT server.",
      fields: [
        { path: "netvideo_source.srt_caller.address", label: "Remote address", kind: "text" },
        {
          path: "netvideo_source.srt_caller.port",
          label: "Port",
          kind: "number",
          min: 1,
          max: 65535,
        },
        {
          path: "netvideo_source.srt_caller.latency",
          label: "Latency",
          kind: "number",
          unit: "ms",
          min: 20,
        },
        { path: "netvideo_source.srt_caller.stream_id", label: "Stream ID", kind: "text" },
        {
          path: "netvideo_source.srt_caller.password",
          label: "Passphrase",
          kind: "password",
          help: "Leave unchanged to keep the current passphrase.",
        },
        ...(ifaceOptions.length > 0
          ? [
              {
                path: "netvideo_source.srt_caller.adapter",
                label: "Interface",
                kind: "select" as const,
                options: ifaceOptions,
              },
            ]
          : []),
      ],
    });
  }

  if (src.rtmp_receive) {
    sections.push({
      title: "RTMP (receive)",
      description: "A remote encoder pushes to this unit.",
      fields: [{ path: "netvideo_source.rtmp_receive.stream", label: "Stream key", kind: "text" }],
    });
  }

  if (src.rtmp_pull) {
    sections.push({
      title: "RTMP (pull)",
      description: "This unit connects out to a remote RTMP server.",
      fields: [
        { path: "netvideo_source.rtmp_pull.url", label: "URL", kind: "text" },
        { path: "netvideo_source.rtmp_pull.stream", label: "Stream key", kind: "text" },
      ],
    });
  }

  return sections;
}

function VideoInputSettingsEditor({ index }: { index: number }) {
  const meta = useUnitMeta();
  const client = useIntinorClient();
  const load = useCallback(() => client.getVideoInputSettings(index), [client, index]);
  const save = useCallback(
    (body: VideoInputSettingsResponse) =>
      client.putVideoInputSettings(index, body as VideoInputSettings & RequestMetadata),
    [client, index],
  );

  const editor = useSettingsEditor<VideoInputSettingsResponse>({
    load,
    save,
    sectionsOf: netvideoSections,
    mutableOf: (s) => s._constraints?.mutable,
  });

  return (
    <SettingsForm
      title={`Netvideo in ${index + 1} settings`}
      description="RTSP/HLS/NDI/RTMP pull, RTMP receive, and SRT caller/listener for this ingest."
      editor={editor}
      meta={meta}
    />
  );
}

export default function NetvideoInputsPage() {
  const client = useIntinorClient();
  const [list, setList] = useState<VideoInputsList | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { consumePending } = useSelectionHandoff();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const l = await client.getVideoInputs();
        if (cancelled) return;
        setList(l);
        const pending = consumePending("video_input");
        const hasPending = pending != null && l.video_inputs.some((i) => i.index === pending);
        setSelected(hasPending ? pending : (l.video_inputs[0]?.index ?? null));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Netvideo inputs");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consumePending is stable and must not re-run this on every render
  }, [client]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (!list || selected == null) {
    return <p className="text-sm text-faint">Loading Netvideo inputs…</p>;
  }
  if (list.video_inputs.length === 0) {
    return <p className="text-sm text-faint">This unit has no Netvideo inputs.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PipePicker
        label="Netvideo input"
        items={list.video_inputs}
        selected={selected}
        onSelect={setSelected}
      />
      <VideoInputSettingsEditor key={selected} index={selected} />
    </div>
  );
}
