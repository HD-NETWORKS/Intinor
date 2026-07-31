"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useSourceUsage, usageLabelsExcluding } from "@/hooks/useSourceUsage";
import type {
  EncodersList,
  EncoderSettingsRequest,
  EncoderSettingsResponse,
  MuxingSettingsConstraints,
} from "@/lib/intinor/types";
import type { FieldSection, SelectOption } from "@/lib/settings/fields";
import { optionsFromDescribed, optionsFromEncodingModes } from "@/lib/settings/options";
import {
  accessControlSections,
  basicDestinationSections,
  onRequestDestinationSections,
  recordingSections,
  rtmpDestinationSections,
} from "@/lib/settings/common-sections";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { useUnitMeta } from "@/hooks/useUnitMeta";
import { useSelectionHandoff } from "@/lib/navigation/selection";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { PipePicker } from "@/components/settings/PipePicker";

/**
 * DVB muxing / PSI-SI tables for this encoder's transport stream — see the
 * MuxingSettings note in lib/intinor/types.ts. Only rendered when the
 * settings response actually includes a `muxing` object, so units/firmware
 * that don't expose this stays unaffected.
 */
function muxingSection(s: EncoderSettingsResponse): FieldSection[] {
  if (!s.muxing) return [];
  const c = (s._constraints?.muxing ?? {}) as MuxingSettingsConstraints;

  return [
    {
      title: "Muxing",
      description: "Transport stream packaging: PIDs, PSI/SI table timing, and DVB metadata.",
      fields: [
        {
          path: "muxing.mode",
          label: "Mode",
          kind: "select",
          options: optionsFromDescribed(c.mode),
        },
        { path: "muxing.transport_stream_id", label: "Transport stream ID", kind: "number" },
        {
          path: "muxing.program_number",
          label: "Program number",
          kind: "number",
          help: "PMT program number or SDT service ID.",
        },
        {
          path: "muxing.mp2_audio_stream_type",
          label: "MP2 audio stream type",
          kind: "select",
          options: optionsFromDescribed(c.mp2_audio_stream_type),
          help: "Signals MPEG audio stream type.",
        },
        {
          path: "muxing.video.pid",
          label: "Video packet ID (PID)",
          kind: "number",
          help: "Identifies the video elementary stream.",
        },
        { path: "muxing.video.component_tag", label: "Video component tag", kind: "text" },
        {
          path: "muxing.pcr.repetition_interval",
          label: "PCR repetition interval",
          kind: "number",
          unit: "s",
          step: 0.01,
        },
        {
          path: "muxing.pmt.pid",
          label: "PMT packet ID (PID)",
          kind: "number",
        },
        {
          path: "muxing.pmt.repetition_interval",
          label: "PMT repetition interval",
          kind: "number",
          unit: "s",
          step: 0.01,
        },
      ],
    },
    {
      title: "Muxing — DVB tables",
      description: "Network Information, Event Information, Time & Date, and Service Description tables.",
      fields: [
        { path: "muxing.dvb.nit.network_name", label: "Network name (NIT)", kind: "text" },
        { path: "muxing.dvb.nit.network_id", label: "Network ID (NIT)", kind: "number" },
        {
          path: "muxing.dvb.nit.repetition_interval",
          label: "NIT repetition interval",
          kind: "number",
          unit: "s",
        },
        {
          path: "muxing.dvb.eit.repetition_interval",
          label: "EIT repetition interval",
          kind: "number",
          unit: "s",
        },
        {
          path: "muxing.dvb.tdt.repetition_interval",
          label: "TDT repetition interval",
          kind: "number",
          unit: "s",
        },
        { path: "muxing.dvb.sdt.service_name", label: "Service name (SDT)", kind: "text" },
        {
          path: "muxing.dvb.sdt.service_provider_name",
          label: "Service provider name (SDT)",
          kind: "text",
        },
        {
          path: "muxing.dvb.sdt.repetition_interval",
          label: "SDT repetition interval",
          kind: "number",
          unit: "s",
        },
      ],
    },
    {
      title: "Muxing — metadata",
      fields: [
        { path: "muxing.klv_metadata.active", label: "KLV metadata", kind: "checkbox" },
        {
          path: "muxing.authentication_metadata.active",
          label: "Authentication metadata",
          kind: "checkbox",
        },
      ],
    },
  ];
}

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
  sections.push(...basicDestinationSections(s.destinations?.basic, protocolOptions));
  sections.push(...onRequestDestinationSections(s.destinations));
  sections.push(...rtmpDestinationSections(s.destinations?.rtmp));
  sections.push(...recordingSections(s.recording));
  sections.push(...accessControlSections(s.access_control));
  sections.push(...muxingSection(s));

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
      title={`Encoder ${index + 1} settings`}
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
  const { consumePending } = useSelectionHandoff();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const l = await client.getEncoders();
        if (cancelled) return;
        setList(l);
        const pending = consumePending("encoder");
        const hasPending = pending != null && l.encoders.some((i) => i.index === pending);
        setSelected(hasPending ? pending : (l.encoders[0]?.index ?? null));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load encoders");
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
    return <p className="text-sm text-faint">Loading encoders…</p>;
  }
  if (list.encoders.length === 0) {
    return <p className="text-sm text-faint">This unit has no encoders.</p>;
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
