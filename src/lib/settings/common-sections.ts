/**
 * Field-section builders shared between the encoder and network-input
 * settings pages — both resources carry the same `recording`,
 * `access_control`, and `destinations.basic[]` shapes (see
 * docs/02-intinor-api-definitions-full.md), so the layout is written once
 * here instead of duplicated per page.
 */

import type {
  AccessControlSettings,
  DestinationsSettingsBasic,
  PipeRecordingSettings,
} from "@/lib/intinor/types";
import type { FieldSection, SelectOption } from "./fields";

export function recordingSections(
  recording: PipeRecordingSettings | undefined,
  basePath = "recording",
): FieldSection[] {
  if (!recording) return [];
  const sections: FieldSection[] = [];

  if (recording.mpegts) {
    sections.push({
      title: "Recording — MPEG-TS",
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
      title: "Recording — FLV",
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

export function accessControlSections(
  list: AccessControlSettings[] | undefined,
  basePath = "access_control",
): FieldSection[] {
  return (list ?? []).map((rule, i) => ({
    title: `Access rule ${i + 1}${rule.description ? ` — ${rule.description}` : ""}`,
    description: "Restricts who may connect to this source by IP, key, or unit serial.",
    fields: [
      { path: `${basePath}[${i}].active`, label: "Active", kind: "checkbox" },
      { path: `${basePath}[${i}].description`, label: "Description", kind: "text" },
      { path: `${basePath}[${i}].ip`, label: "IP address", kind: "text" },
      { path: `${basePath}[${i}].key`, label: "Access key", kind: "text" },
      { path: `${basePath}[${i}].serial`, label: "Remote unit serial", kind: "text" },
    ],
  }));
}

/** One section per configured `destinations.basic[]` push destination. */
export function basicDestinationSections(
  basic: DestinationsSettingsBasic[] | undefined,
  protocolOptions: SelectOption[],
  basePath = "destinations",
): FieldSection[] {
  return (basic ?? []).map((dest, i) => ({
    title: `Destination ${i + 1}${dest.description ? ` — ${dest.description}` : ""}`,
    description: "Where this pipe pushes its output.",
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
      ],
    });
  }

  return sections;
}

export function rtmpDestinationSections(
  rtmp: Array<{ description?: string; url?: string }> | undefined,
  basePath = "destinations",
): FieldSection[] {
  return (rtmp ?? []).map((dest, i) => ({
    title: `RTMP destination ${i + 1}${dest.description ? ` — ${dest.description}` : ""}`,
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
