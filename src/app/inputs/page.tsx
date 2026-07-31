"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useSourceUsage } from "@/hooks/useSourceUsage";
import type {
  NetworkInput,
  NetworkInputsList,
  NetworkInputSettings,
  NetworkInputSettingsResponse,
  RequestMetadata,
} from "@/lib/intinor/types";
import type { FieldSection } from "@/lib/settings/fields";
import { optionsFromDescribed } from "@/lib/settings/options";
import {
  accessControlSections,
  basicDestinationSections,
  recordingSections,
} from "@/lib/settings/common-sections";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
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
}

function inputSections(s: NetworkInputSettingsResponse): FieldSection[] {
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

  // Direct passthrough destinations — the input pushes its raw ingest onward,
  // bypassing this unit's own encoders. Non-DVB-compliant but useful for
  // relaying/forwarding a feed.
  if (s.destinations) {
    const protocolOptions = optionsFromDescribed(
      (s._constraints?.destinations as { protocol?: { value?: string; description?: string }[] })
        ?.protocol,
    );
    sections.push(...basicDestinationSections(s.destinations.basic, protocolOptions));
  }

  sections.push(...recordingSections(s.recording));
  sections.push(...accessControlSections(s.access_control));

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
      <div className="mx-auto max-w-4xl rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-danger">
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
