"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useSourceUsage } from "@/hooks/useSourceUsage";
import type {
  DestinationsSettingsConstraints,
  NetworkInput,
  NetworkInputsList,
  NetworkInputSettings,
  NetworkInputSettingsResponse,
  NetworkSourcesSmpte20227,
  NetworkSourcesSmpte20227Source,
  RequestMetadata,
} from "@/lib/intinor/types";
import type { FieldSection } from "@/lib/settings/fields";
import { optionsFromDescribed } from "@/lib/settings/options";
import {
  accessControlSections,
  advancedDestinationSection,
  arrayHeaderSection,
  basicDestinationSections,
  newAccessControlRule,
  onRequestDestinationSections,
  recordingSections,
  RemoveButton,
} from "@/lib/settings/common-sections";
import { useSettingsEditor, type ArrayHelpers } from "@/hooks/useSettingsEditor";
import { useUnitMeta } from "@/hooks/useUnitMeta";
import { useSelectionHandoff } from "@/lib/navigation/selection";
import { usePolledResource } from "@/hooks/usePolledResource";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { StreamPreviewSection } from "@/components/settings/StreamPreviewSection";
import { PipePicker } from "@/components/settings/PipePicker";

/** `_constraints` for this resource is loosely typed; narrow just what we read. */
interface NetworkSourceConstraints {
  udp_unicast?: { network_interface?: { value?: string; description?: string }[] };
  udp_multicast?: { network_interface?: { value?: string; description?: string }[] };
  advanced?: {
    tcp_receive_buffer?: { min: number; max: number };
    decoder_buffer?: { min: number; max: number };
  };
  smpte_2022_7?: {
    protocol?: { value?: string; description?: string }[];
    network_interface?: { value?: string; description?: string }[];
    skew?: { min: number; max: number };
  };
}

/** A fresh, inactive SMPTE 2022-7 leg — filled in and activated by hand before saving. */
function newSmpte20227Source(protocol: string): NetworkSourcesSmpte20227Source {
  return { description: "", protocol, active: false };
}

/**
 * SMPTE 2022-7 seamless protection switching: two (usually) independent
 * network paths carrying the same feed. Not on every unit/firmware — only
 * rendered when the loaded settings actually include the block.
 */
function smpte20227Sections(
  smpte: NetworkSourcesSmpte20227 | undefined,
  c: NetworkSourceConstraints["smpte_2022_7"],
  helpers: ArrayHelpers,
): FieldSection[] {
  if (!smpte) return [];
  const protocolOptions = optionsFromDescribed(c?.protocol);
  const ifaceOptions = optionsFromDescribed(c?.network_interface);
  // Older firmware has no `sources[]` at all (a fixed `port` + `srt_caller[]`
  // instead, see the NetworkSourcesSmpte20227 doc comment) — the generic
  // resizable-legs editor below only applies once the unit actually has it.
  const hasSourcesArray = Array.isArray(smpte.sources);
  const sourceCount = smpte.sources?.length ?? 0;

  return [
    {
      title: "SMPTE 2022-7",
      description:
        "Seamless protection switching over two independent network paths. \"Skew\" is the maximum timing difference tolerated between them.",
      fields: [
        { path: "network_sources.smpte_2022_7.active", label: "Active", kind: "checkbox" },
        {
          path: "network_sources.smpte_2022_7.skew",
          label: "Skew",
          kind: "number",
          unit: "s",
          step: 0.01,
          min: c?.skew?.min,
          max: c?.skew?.max,
        },
        // Older firmware's fixed second leg — no `sources[]` to pick a port per-leg from.
        ...(!hasSourcesArray && smpte.port != null
          ? [
              {
                path: "network_sources.smpte_2022_7.port",
                label: "Port",
                kind: "number" as const,
                min: 1,
                max: 65535,
              },
            ]
          : []),
      ],
    },
    ...(hasSourcesArray
      ? [
          arrayHeaderSection(`SMPTE 2022-7 sources (${sourceCount})`, () =>
            helpers.addArrayItem(
              "network_sources.smpte_2022_7.sources",
              newSmpte20227Source(protocolOptions[0]?.value ?? "udp_unicast"),
            ),
          ),
        ]
      : []),
    ...(smpte.sources ?? []).map((src, i) => ({
      title: `Source ${i + 1}${src.description ? ` (${src.description})` : ""}`,
      headerExtra: (
        <RemoveButton
          onClick={() => helpers.removeArrayItem("network_sources.smpte_2022_7.sources", i)}
        />
      ),
      fields: [
        {
          path: `network_sources.smpte_2022_7.sources[${i}].active`,
          label: "Active",
          kind: "checkbox" as const,
        },
        {
          path: `network_sources.smpte_2022_7.sources[${i}].description`,
          label: "Description",
          kind: "text" as const,
        },
        {
          path: `network_sources.smpte_2022_7.sources[${i}].protocol`,
          label: "Protocol",
          kind: "select" as const,
          options: protocolOptions,
        },
        {
          path: `network_sources.smpte_2022_7.sources[${i}].network_interface`,
          label: "Interface",
          kind: "select" as const,
          options: ifaceOptions,
        },
        {
          path: `network_sources.smpte_2022_7.sources[${i}].address`,
          label: "Address",
          kind: "text" as const,
          help: "Multicast group address, or the remote address for an SRT caller leg.",
        },
        {
          path: `network_sources.smpte_2022_7.sources[${i}].port`,
          label: "Port",
          kind: "number" as const,
          min: 1,
          max: 65535,
        },
        {
          path: `network_sources.smpte_2022_7.sources[${i}].srt.latency`,
          label: "SRT latency",
          kind: "number" as const,
          unit: "ms",
          min: 20,
        },
        {
          path: `network_sources.smpte_2022_7.sources[${i}].srt.password`,
          label: "SRT passphrase",
          kind: "password" as const,
          help: "Only used when protocol is an SRT caller leg. Leave unchanged to keep the current passphrase.",
        },
      ],
    })),
  ];
}

function inputSections(
  s: NetworkInputSettingsResponse,
  helpers: ArrayHelpers,
): FieldSection[] {
  const c = (s._constraints?.network_sources ?? {}) as NetworkSourceConstraints;
  const src = s.network_sources;
  const ifaceOptions = optionsFromDescribed(c.udp_unicast?.network_interface);

  const sections: FieldSection[] = [
    {
      title: "Input",
      fields: [
        { path: "description", label: "Description", kind: "text" },
        { path: "active", label: "Input active", kind: "checkbox" },
      ],
    },
  ];

  if (src.udp_unicast) {
    sections.push({
      title: "SRT listener / unicast",
      description: "The unit waits for an incoming connection on this port.",
      fields: [
        { path: "network_sources.udp_unicast.active", label: "Active", kind: "checkbox" },
        {
          path: "network_sources.udp_unicast.port",
          label: "Listen port",
          kind: "number",
          min: 1,
          max: 65535,
        },
        {
          path: "network_sources.udp_unicast.network_interface",
          label: "Interface",
          kind: "select",
          options: ifaceOptions,
        },
        {
          path: "network_sources.udp_unicast.srt.latency",
          label: "SRT latency",
          kind: "number",
          unit: "ms",
          min: 20,
        },
        {
          path: "network_sources.udp_unicast.srt.password",
          label: "SRT passphrase",
          kind: "password",
        },
      ],
    });
  }

  if (src.srt_caller) {
    sections.push({
      title: "SRT caller",
      description: "The unit dials out to a remote SRT server.",
      fields: [
        { path: "network_sources.srt_caller.active", label: "Active", kind: "checkbox" },
        { path: "network_sources.srt_caller.address", label: "Remote address", kind: "text" },
        {
          path: "network_sources.srt_caller.port",
          label: "Port",
          kind: "number",
          min: 1,
          max: 65535,
        },
        {
          path: "network_sources.srt_caller.latency",
          label: "Latency",
          kind: "number",
          unit: "ms",
          min: 20,
        },
        { path: "network_sources.srt_caller.stream_id", label: "Stream ID", kind: "text" },
        {
          path: "network_sources.srt_caller.password",
          label: "Passphrase",
          kind: "password",
          help: "Leave unchanged to keep the current passphrase.",
        },
      ],
    });
  }

  if (src.udp_multicast) {
    sections.push({
      title: "UDP multicast",
      fields: [
        { path: "network_sources.udp_multicast.active", label: "Active", kind: "checkbox" },
        { path: "network_sources.udp_multicast.address", label: "Group address", kind: "text" },
        {
          path: "network_sources.udp_multicast.port",
          label: "Port",
          kind: "number",
          min: 1,
          max: 65535,
        },
      ],
    });
  }

  if (src.rtmp) {
    sections.push({
      title: "RTMP",
      fields: [
        { path: "network_sources.rtmp.active", label: "Active", kind: "checkbox" },
        { path: "network_sources.rtmp.url", label: "URL", kind: "text" },
        { path: "network_sources.rtmp.stream", label: "Stream key", kind: "text" },
      ],
    });
  }

  if (src.tcp_receive) {
    sections.push({
      title: "TCP receive",
      fields: [
        { path: "network_sources.tcp_receive.active", label: "Active", kind: "checkbox" },
        {
          path: "network_sources.tcp_receive.port",
          label: "Port",
          kind: "number",
          min: 1,
          max: 65535,
        },
      ],
    });
  }

  if (src.advanced) {
    sections.push({
      title: "Advanced",
      description: "Buffering. Raising these adds latency but tolerates worse networks.",
      fields: [
        {
          path: "network_sources.advanced.tcp_receive_buffer",
          label: "TCP receive buffer",
          kind: "number",
          unit: "s",
          step: 0.1,
          min: c.advanced?.tcp_receive_buffer?.min,
          max: c.advanced?.tcp_receive_buffer?.max,
        },
        {
          path: "network_sources.advanced.decoder_buffer",
          label: "Decoder buffer",
          kind: "number",
          unit: "s",
          step: 0.1,
          min: c.advanced?.decoder_buffer?.min,
          max: c.advanced?.decoder_buffer?.max,
        },
      ],
    });
  }

  sections.push(...smpte20227Sections(src.smpte_2022_7, c.smpte_2022_7, helpers));

  // Direct passthrough destinations — the input pushes its raw ingest onward,
  // bypassing this unit's own encoders. Non-DVB-compliant but useful for
  // relaying/forwarding a feed.
  if (s.destinations) {
    const destC = s._constraints?.destinations as DestinationsSettingsConstraints | undefined;
    const protocolOptions = optionsFromDescribed(destC?.protocol);
    sections.push(...basicDestinationSections(s.destinations.basic, protocolOptions));
    sections.push(...onRequestDestinationSections(s.destinations));
    sections.push(...advancedDestinationSection(s.destinations.advanced, destC?.advanced));
  }

  sections.push(...recordingSections(s.recording));
  const accessRuleCount = s.access_control?.length ?? 0;
  sections.push(
    arrayHeaderSection(`Access rules (${accessRuleCount})`, () =>
      helpers.addArrayItem("access_control", newAccessControlRule()),
    ),
  );
  sections.push(
    ...accessControlSections(s.access_control, "access_control", (i) =>
      helpers.removeArrayItem("access_control", i),
    ),
  );

  return sections;
}

function InputSettingsEditor({ index }: { index: number }) {
  const meta = useUnitMeta();
  const client = useIntinorClient();
  const { usage } = useSourceUsage();
  // Usage is keyed by the full source href the unit reports; match this
  // input's own index by suffix rather than requiring an exact string.
  const usedBy = useMemo(() => {
    const match = Array.from(usage.entries()).find(([source]) =>
      source.endsWith(`/network_inputs/${index}`),
    );
    return match ? match[1].map((e) => e.label) : [];
  }, [usage, index]);
  const { data: preview } = usePolledResource<NetworkInput>(
    `network_inputs/${index}?include=thumbnails`,
    8000,
  );
  const thumbId = preview?.thumbnails?.thumbnails[0]?.id;
  const load = useCallback(() => client.getNetworkInputSettings(index), [client, index]);
  const save = useCallback(
    (body: NetworkInputSettingsResponse) =>
      client.putNetworkInputSettings(index, body as NetworkInputSettings & RequestMetadata),
    [client, index],
  );

  const editor = useSettingsEditor<NetworkInputSettingsResponse>({
    load,
    save,
    sectionsOf: inputSections,
    mutableOf: (s) => s._constraints?.mutable,
  });

  return (
    <div className="space-y-3">
      {usedBy.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-warning">
          {usedBy.length > 1 ? (
            <>⚠ Used by {usedBy.length} consumers: {usedBy.join(", ")}</>
          ) : (
            <>Used by {usedBy[0]}</>
          )}
        </div>
      )}
      <StreamPreviewSection
        thumbId={thumbId}
        urlBuilder={(id, opts) => client.networkInputThumbnailUrl(index, id, { ...opts, width: 640 })}
        alt={`Network input ${index + 1} preview`}
        downloadFilename={`network-input-${index + 1}-snapshot.jpg`}
      />
      <SettingsForm
        title={`Network input ${index + 1} settings`}
        description="SRT caller/listener, RTMP, multicast and buffering for this ingest."
        editor={editor}
        meta={meta}
      />
    </div>
  );
}

export default function InputsPage() {
  const client = useIntinorClient();
  const [list, setList] = useState<NetworkInputsList | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { consumePending } = useSelectionHandoff();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const l = await client.getNetworkInputs();
        if (cancelled) return;
        setList(l);
        const pending = consumePending("network_input");
        const hasPending = pending != null && l.network_inputs.some((i) => i.index === pending);
        setSelected(hasPending ? pending : (l.network_inputs[0]?.index ?? null));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load network inputs");
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
      <div className="mx-auto max-w-4xl rounded border border-signal-red-500/40 bg-signal-red-500/10 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (!list || selected == null) {
    return <p className="text-sm text-faint">Loading network inputs…</p>;
  }
  if (list.network_inputs.length === 0) {
    return <p className="text-sm text-faint">This unit has no network inputs.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PipePicker
        label="Input"
        items={list.network_inputs}
        selected={selected}
        onSelect={setSelected}
      />
      <InputSettingsEditor key={selected} index={selected} />
    </div>
  );
}
