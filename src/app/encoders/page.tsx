"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useSourceUsage, usageLabelsExcluding } from "@/hooks/useSourceUsage";
import type {
  EncodersList,
  EncoderSettingsRequest,
  EncoderSettingsResponse,
} from "@/lib/intinor/types";
import type { FieldSection, SelectOption } from "@/lib/settings/fields";
import { optionsFromDescribed, optionsFromEncodingModes } from "@/lib/settings/options";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { useUnitMeta } from "@/hooks/useUnitMeta";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { PipePicker } from "@/components/settings/PipePicker";

/** Append "— used by X, Y" to options whose value is already in use elsewhere — a heads-up, not a block. */
function withUsageHints(options: SelectOption[], usage: Map<string, string[]>): SelectOption[] {
  return options.map((o) => {
    const users = usage.get(o.value);
    return users && users.length > 0 ? { ...o, label: `${o.label} — used by ${users.join(", ")}` } : o;
  });
}

/** Form layout built from the encoder's own `_constraints`. */
function encoderSections(s: EncoderSettingsResponse, sourceUsage: Map<string, string[]>): FieldSection[] {
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
          options: withUsageHints(optionsFromDescribed(c?.video_source?.source), sourceUsage),
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
  const { usage, refresh: refreshUsage } = useSourceUsage();
  const sourceUsage = useMemo(
    () => usageLabelsExcluding(usage, { kind: "encoder", index }),
    [usage, index],
  );
  const load = useCallback(() => client.getEncoderSettings(index), [client, index]);
  const save = useCallback(
    async (body: EncoderSettingsResponse) => {
      const res = await client.putEncoderSettings(index, body as EncoderSettingsRequest);
      void refreshUsage();
      return res;
    },
    [client, index, refreshUsage],
  );

  const editor = useSettingsEditor<EncoderSettingsResponse>({
    load,
    save,
    sectionsOf: (s) => encoderSections(s, sourceUsage),
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
