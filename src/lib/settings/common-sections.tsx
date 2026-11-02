/**
 * Field-section builders shared between the encoder and network-input
 * settings pages — both resources carry the same `recording`,
 * `access_control`, and `destinations.basic[]` shapes (see
 * docs/02-intinor-api-definitions-full.md), so the layout is written once
 * here instead of duplicated per page.
 */

import type {
  AccessControlSettings,
  DestinationsSettingsAdvanced,
  DestinationsSettingsBasic,
  DestinationsSettingsConstraints,
  DestinationsSettingsRtmp,
  PipeRecordingSettings,
} from "@/lib/intinor/types";
import type { FieldSection, SelectOption } from "./fields";
import { optionsFromDescribed } from "./options";

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-signal-red-500/40 px-2 py-1 text-xs text-danger hover:bg-signal-red-500/10"
    >
      Remove
    </button>
  );
}

/** A fields-less section whose only purpose is a title + "+ Add …" button above a list of per-item sections. */
export function arrayHeaderSection(title: string, onAdd: () => void): FieldSection {
  return {
    title,
    fields: [],
    headerExtra: (
      <button
        type="button"
        onClick={onAdd}
        className="rounded border border-brand-500/60 bg-brand-500/10 px-3 py-1 text-xs text-accent hover:bg-brand-500/20"
      >
        + Add
      </button>
    ),
  };
}

export function recordingSections(
  recording: PipeRecordingSettings | undefined,
  basePath = "recording",
): FieldSection[] {
  if (!recording) return [];
  const sections: FieldSection[] = [];

  if (recording.mpegts) {
    sections.push({
      title: "Recording: MPEG-TS",
      fields: [
        { path: `${basePath}.mpegts.active`, label: "Active", kind: "checkbox" },
        { path: `${basePath}.mpegts.path`, label: "Path", kind: "text" },
        {
          path: `${basePath}.mpegts.max_file_size`,
          label: "Max file size",
          kind: "number",
          unit: "MB",
          min: 0,
        },
      ],
    });
  }

  if (recording.flv) {
    sections.push({
      title: "Recording: FLV",
      fields: [
        { path: `${basePath}.flv.active`, label: "Active", kind: "checkbox" },
        { path: `${basePath}.flv.path`, label: "Path", kind: "text" },
        {
          path: `${basePath}.flv.max_file_size`,
          label: "Max file size",
          kind: "number",
          unit: "MB",
          min: 0,
        },
      ],
    });
  }

  return sections;
}

/**
 * A fresh, inactive rule — filled in and activated by hand before saving.
 * `ip`/`key`/`serial` are left entirely absent (not empty strings): the unit
 * rejects a rule that sets both `ip` and `key`, and treats an empty-string
 * `ip` as "set" just like a real one — only a genuinely absent field counts
 * as unused.
 */
export function newAccessControlRule(): AccessControlSettings {
  return { description: "New access rule", active: false };
}

export function accessControlSections(
  list: AccessControlSettings[] | undefined,
  basePath = "access_control",
  onRemove?: (index: number) => void,
): FieldSection[] {
  return (list ?? []).map((rule, i) => ({
    title: `Access rule ${i + 1}${rule.description ? ` (${rule.description})` : ""}`,
    description:
      "Restricts who may connect to this source. Fill in exactly one of IP, key, or serial below, not more than one.",
    headerExtra: onRemove ? <RemoveButton onClick={() => onRemove(i)} /> : undefined,
    fields: [
      { path: `${basePath}[${i}].active`, label: "Active", kind: "checkbox" },
      { path: `${basePath}[${i}].description`, label: "Description", kind: "text" },
      {
        path: `${basePath}[${i}].ip`,
        label: "IP address",
        kind: "text",
        help: "Leave blank if you're using a key or serial below: the unit rejects a rule that sets more than one.",
      },
      {
        path: `${basePath}[${i}].key`,
        label: "Access key",
        kind: "text",
        help: "Paste the other unit's sender key (Settings → General → Access control on that unit). If the copied text has a trailing name after the key itself, e.g. \"...Kw== Direkt-D01796\", that's just a label; paste only the part before the space, and leave IP/serial below blank.",
      },
      {
        path: `${basePath}[${i}].serial`,
        label: "Remote unit serial",
        kind: "text",
        help: "Leave blank if you're using a key above: the unit rejects a rule that sets more than one.",
      },
    ],
  }));
}

/** One section per configured `destinations.basic[]` push destination. */
export function basicDestinationSections(
  basic: DestinationsSettingsBasic[] | undefined,
  protocolOptions: SelectOption[],
  basePath = "destinations",
  onRemove?: (index: number) => void,
): FieldSection[] {
  return (basic ?? []).map((dest, i) => ({
    title: `Destination ${i + 1}${dest.description ? ` (${dest.description})` : ""}`,
    description: "Where this pipe pushes its output.",
    headerExtra: onRemove ? <RemoveButton onClick={() => onRemove(i)} /> : undefined,
    fields: [
      { path: `${basePath}.basic[${i}].active`, label: "Active", kind: "checkbox" },
      { path: `${basePath}.basic[${i}].description`, label: "Description", kind: "text" },
      {
        path: `${basePath}.basic[${i}].protocol`,
        label: "Protocol",
        kind: "select",
        options: protocolOptions,
      },
      { path: `${basePath}.basic[${i}].address`, label: "Address", kind: "text" },
      {
        path: `${basePath}.basic[${i}].port`,
        label: "Port",
        kind: "number",
        min: 1,
        max: 65535,
      },
      ...(dest.srt
        ? [
            {
              path: `${basePath}.basic[${i}].srt.latency`,
              label: "SRT latency",
              kind: "number" as const,
              unit: "ms",
              min: 20,
            },
            {
              path: `${basePath}.basic[${i}].srt.stream_id`,
              label: "SRT stream ID",
              kind: "text" as const,
            },
            {
              path: `${basePath}.basic[${i}].srt.password`,
              label: "SRT passphrase",
              kind: "password" as const,
              help: "Leave unchanged to keep the current passphrase.",
            },
          ]
        : []),
    ],
  }));
}

/** "The unit listens; a remote client pulls" — on-request push variants. */
export function onRequestDestinationSections(
  destinations: { srt_on_request?: { active: boolean }; tcp_on_request?: { active: boolean } } | undefined,
  basePath = "destinations",
): FieldSection[] {
  const sections: FieldSection[] = [];

  if (destinations?.srt_on_request) {
    sections.push({
      title: "SRT on request",
      description: "The unit listens for an incoming SRT pull connection.",
      fields: [
        {
          path: `${basePath}.srt_on_request.active`,
          label: "Active",
          kind: "checkbox",
        },
        {
          path: `${basePath}.srt_on_request.local_port`,
          label: "Listen port",
          kind: "number",
          min: 1,
          max: 65535,
        },
        {
          path: `${basePath}.srt_on_request.latency`,
          label: "Latency",
          kind: "number",
          unit: "ms",
          min: 20,
        },
        {
          path: `${basePath}.srt_on_request.extra_delay`,
          label: "Extra delay",
          kind: "number",
          unit: "ms",
          min: 0,
        },
        {
          path: `${basePath}.srt_on_request.key_length`,
          label: "Encryption key length",
          kind: "number",
          help: "0 = automatic/off, 16 = AES-128, 24 = AES-192, 32 = AES-256.",
        },
        {
          path: `${basePath}.srt_on_request.rtp_over_srt`,
          label: "RTP over SRT",
          kind: "checkbox",
        },
        {
          path: `${basePath}.srt_on_request.adapter`,
          label: "Network interface",
          kind: "text",
          help: "Leave blank to bind on the default interface.",
        },
        {
          path: `${basePath}.srt_on_request.password`,
          label: "Passphrase",
          kind: "password",
          help: "Leave unchanged to keep the current passphrase.",
        },
      ],
    });
  }

  if (destinations?.tcp_on_request) {
    sections.push({
      title: "TCP on request",
      description: "The unit listens for an incoming TCP pull connection.",
      fields: [
        {
          path: `${basePath}.tcp_on_request.active`,
          label: "Active",
          kind: "checkbox",
        },
        {
          path: `${basePath}.tcp_on_request.local_port`,
          label: "Listen port",
          kind: "number",
          min: 1,
          max: 65535,
        },
        {
          path: `${basePath}.tcp_on_request.extra_delay`,
          label: "Extra delay",
          kind: "number",
          unit: "ms",
          min: 0,
        },
      ],
    });
  }

  return sections;
}

/**
 * BRT bonding/redundancy profiles + FEC layout, under `destinations.advanced`.
 * Not on every unit/firmware (added in a later Direkt firmware than this
 * dashboard was originally built against) — only rendered when the loaded
 * settings actually have the block, same convention as every other
 * optional destination group above.
 */
export function advancedDestinationSection(
  advanced: DestinationsSettingsAdvanced | undefined,
  constraints: DestinationsSettingsConstraints["advanced"] | undefined,
  basePath = "destinations",
): FieldSection[] {
  if (!advanced) return [];

  const redundancyOptions = optionsFromDescribed(constraints?.brt?.redundancy_profile);
  const latencyOptions = optionsFromDescribed(constraints?.brt?.latency_profile);
  const bufferOptions = optionsFromDescribed(constraints?.brt?.buffer_profile);
  const selectiveRedundancyOptions = optionsFromDescribed(
    constraints?.brt?.selective_redundancy_profile,
  );

  return [
    {
      title: "Advanced (bonding & redundancy)",
      description:
        "BRT redundancy/FEC settings for bonded or otherwise unreliable links. Set up on the unit itself; shown here read/write once configured.",
      fields: [
        {
          path: `${basePath}.advanced.brt.redundancy_profile`,
          label: "Redundancy profile",
          kind: "select",
          options: redundancyOptions,
        },
        {
          path: `${basePath}.advanced.brt.custom_redundancy`,
          label: "Custom redundancy",
          kind: "number",
          unit: "%",
          min: 0,
          max: 100,
          help: "Only used when redundancy profile is \"custom\".",
        },
        {
          path: `${basePath}.advanced.brt.latency_profile`,
          label: "Latency profile",
          kind: "select",
          options: latencyOptions,
        },
        {
          path: `${basePath}.advanced.brt.custom_latency`,
          label: "Custom latency",
          kind: "number",
          unit: "s",
          step: 0.1,
          min: 0,
        },
        {
          path: `${basePath}.advanced.brt.custom_end_to_end_delay`,
          label: "Custom end-to-end delay",
          kind: "number",
          unit: "s",
          step: 0.1,
          min: 0,
        },
        {
          path: `${basePath}.advanced.brt.buffer_profile`,
          label: "Buffer profile",
          kind: "select",
          options: bufferOptions,
        },
        {
          path: `${basePath}.advanced.brt.selective_redundancy_profile`,
          label: "Selective redundancy",
          kind: "select",
          options: selectiveRedundancyOptions,
        },
        {
          path: `${basePath}.advanced.fec_layout.d`,
          label: "FEC columns (D)",
          kind: "number",
          min: 0,
        },
        {
          path: `${basePath}.advanced.fec_layout.l`,
          label: "FEC rows (L)",
          kind: "number",
          min: 0,
        },
        {
          path: `${basePath}.advanced.udp_bonding_delay`,
          label: "UDP bonding delay",
          kind: "number",
          unit: "s",
          step: 0.1,
          min: constraints?.udp_bonding_delay?.min,
          max: constraints?.udp_bonding_delay?.max,
        },
        {
          path: `${basePath}.advanced.udp_smoothing_buffer`,
          label: "UDP smoothing buffer",
          kind: "number",
          unit: "s",
          step: 0.1,
          min: constraints?.udp_smoothing_buffer?.min,
          max: constraints?.udp_smoothing_buffer?.max,
        },
        {
          path: `${basePath}.advanced.extra_delay`,
          label: "Extra delay",
          kind: "number",
          unit: "ms",
          min: constraints?.extra_delay?.min,
          max: constraints?.extra_delay?.max,
        },
      ],
    },
  ];
}

export function rtmpDestinationSections(
  rtmp: DestinationsSettingsRtmp[] | undefined,
  basePath = "destinations",
  onRemove?: (index: number) => void,
): FieldSection[] {
  return (rtmp ?? []).map((dest, i) => ({
    title: `RTMP destination ${i + 1}${dest.description ? ` (${dest.description})` : ""}`,
    headerExtra: onRemove ? <RemoveButton onClick={() => onRemove(i)} /> : undefined,
    fields: [
      { path: `${basePath}.rtmp[${i}].active`, label: "Active", kind: "checkbox" },
      { path: `${basePath}.rtmp[${i}].description`, label: "Description", kind: "text" },
      { path: `${basePath}.rtmp[${i}].url`, label: "URL", kind: "text" },
      { path: `${basePath}.rtmp[${i}].stream`, label: "Stream key", kind: "text" },
      { path: `${basePath}.rtmp[${i}].user`, label: "Username", kind: "text" },
      {
        path: `${basePath}.rtmp[${i}].password`,
        label: "Password",
        kind: "password",
        help: "Leave unchanged to keep the current password.",
      },
    ],
  }));
}
