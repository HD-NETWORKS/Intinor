"use client";

import { useCallback, useEffect, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type {
  EncodersList,
  EncoderSettingsRequest,
  EncoderSettingsResponse,
} from "@/lib/intinor/types";
import type { FieldSection } from "@/lib/settings/fields";
import { optionsFromDescribed, optionsFromEncodingModes } from "@/lib/settings/options";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { useUnitMeta } from "@/hooks/useUnitMeta";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { PipePicker } from "@/components/settings/PipePicker";

/** Form layout built from the encoder's own `_constraints`. */
function encoderSections(s: EncoderSettingsResponse): FieldSection[] {
  const c = s._constraints;

  const sections: FieldSection[] = [
    {
      title: "Video source",
      description: "Which pipe feeds this encoder, and what to show if it drops.",
      fields: [
        {
          path: "video_source.source",
          label: "Source",
          kind: "select",
          options: optionsFromDescribed(c?.video_source?.source),
        },
        {
          path: "video_source.program_id",
          label: "Program ID",
          kind: "number",
          help: "Only meaningful for multi-program sources.",
        },
        {
          path: "video_source.fallback",
          label: "Fallback",
          kind: "select",
          options: optionsFromDescribed(c?.video_source?.fallback),
        },
      ],
    },
    {
      title: "Encoding",
      description: "Bitrate/codec preset applied to this encoder's output.",
      fields: [
        {
          path: "encoding.encoding_mode",
          label: "Encoding mode",
          kind: "select",
          options: optionsFromEncodingModes(c?.encoding?.encoding_mode),
        },
        ...(c?.encoding?.capabilities?.adaptive_bitrate
          ? ([
              {
                path: "encoding.adaptive_bitrate",
                label: "Adaptive bitrate",
                kind: "checkbox" as const,
                help: "Let the encoder reduce bitrate when the network degrades.",
              },
            ] as const)
          : []),
      ],
    },
  ];

  // One section per push destination — indices come from the settings object,
  // so removing a destination on the unit removes its section here.
  const protocolOptions = optionsFromDescribed(
    c?.destinations?.protocol as { value?: string; description?: string }[] | undefined,
  );
  (s.destinations?.basic ?? []).forEach((dest, i) => {
    sections.push({
      title: `Destination ${i + 1}${dest.description ? ` — ${dest.description}` : ""}`,
      description: "Where this encoder pushes its output.",
      fields: [
        { path: `destinations.basic[${i}].active`, label: "Active", kind: "checkbox" },
        { path: `destinations.basic[${i}].description`, label: "Description", kind: "text" },
        {
          path: `destinations.basic[${i}].protocol`,
          label: "Protocol",
          kind: "select",
          options: protocolOptions,
        },
        { path: `destinations.basic[${i}].address`, label: "Address", kind: "text" },
        { path: `destinations.basic[${i}].port`, label: "Port", kind: "number", min: 1, max: 65535 },
        ...(dest.srt
          ? [
              {
                path: `destinations.basic[${i}].srt.latency`,
                label: "SRT latency",
                kind: "number" as const,
                unit: "ms",
                min: 20,
              },
              {
                path: `destinations.basic[${i}].srt.stream_id`,
                label: "SRT stream ID",
                kind: "text" as const,
              },
              {
                path: `destinations.basic[${i}].srt.password`,
                label: "SRT passphrase",
                kind: "password" as const,
                help: "Leave unchanged to keep the current passphrase.",
              },
            ]
          : []),
      ],
    });
  });

  return sections;
}

function EncoderSettingsEditor({ index }: { index: number }) {
  const meta = useUnitMeta();
  const client = useIntinorClient();
  const load = useCallback(() => client.getEncoderSettings(index), [client, index]);
  const save = useCallback(
    (body: EncoderSettingsResponse) =>
      client.putEncoderSettings(index, body as EncoderSettingsRequest),
    [client, index],
  );

  const editor = useSettingsEditor<EncoderSettingsResponse>({
    load,
    save,
    sectionsOf: encoderSections,
    mutableOf: (s) => s._constraints?.mutable,
  });

  return (
    <SettingsForm
      title={`Encoder #${index} settings`}
      description="Video source, encoding mode, and push destinations."
      editor={editor}
      meta={meta}
    />
  );
}

export default function EncodersPage() {
  const client = useIntinorClient();
  const [list, setList] = useState<EncodersList | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const l = await client.getEncoders();
        if (cancelled) return;
        setList(l);
        setSelected(l.encoders[0]?.index ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load encoders");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!list || selected == null) {
    return <p className="text-sm text-slate-500">Loading encoders…</p>;
  }
  if (list.encoders.length === 0) {
    return <p className="text-sm text-slate-500">This unit has no encoders.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PipePicker
        label="Encoder"
        items={list.encoders}
        selected={selected}
        onSelect={setSelected}
      />
      <EncoderSettingsEditor key={selected} index={selected} />
    </div>
  );
}
