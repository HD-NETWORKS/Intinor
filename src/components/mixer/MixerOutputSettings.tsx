"use client";

import { useCallback } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type {
  RequestMetadata,
  VideoMixerSettings,
  VideoMixerSettingsResponse,
} from "@/lib/intinor/types";
import type { FieldSection } from "@/lib/settings/fields";
import { optionsFromDescribed, optionsFromFormats } from "@/lib/settings/options";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import type { UnitMeta } from "@/hooks/useUnitMeta";
import { SettingsForm } from "@/components/settings/SettingsForm";

interface VideoOutConstraints {
  format?: { value?: string; description: string }[];
  sd_aspect_ratio?: { value?: string; description?: string }[];
}

function outputSections(s: VideoMixerSettingsResponse): FieldSection[] {
  const c = (s._constraints?.video_out ?? {}) as VideoOutConstraints;
  return [
    {
      title: "Output format",
      fields: [
        {
          path: "video_out.format",
          label: "Output format",
          kind: "select",
          options: optionsFromFormats(c.format),
          help: "Resolution / scan / frame rate of the composited program.",
        },
        {
          path: "video_out.sd_aspect_ratio",
          label: "SD aspect ratio",
          kind: "select",
          options: optionsFromDescribed(c.sd_aspect_ratio),
        },
      ],
    },
  ];
}

/**
 * `video_out` editor for a mixer, using the same permission-gated,
 * confirm-diff, GET-modify-PUT path as the encoder and input settings pages.
 *
 * It shares the settings resource with the layout builder on this page, so if
 * a layout is applied after this form loaded, the pre-save re-read surfaces
 * that as a conflict warning rather than silently reverting it.
 */
export function MixerOutputSettings({
  index,
  meta,
  onSaved,
}: {
  index: number;
  meta: UnitMeta | null;
  onSaved?: () => void;
}) {
  const client = useIntinorClient();
  const load = useCallback(() => client.getVideoMixerSettings(index), [client, index]);
  const save = useCallback(
    async (body: VideoMixerSettingsResponse) => {
      const res = await client.putVideoMixerSettings(
        index,
        body as VideoMixerSettings & RequestMetadata,
      );
      onSaved?.();
      return res;
    },
    [client, index, onSaved],
  );

  const editor = useSettingsEditor<VideoMixerSettingsResponse>({
    load,
    save,
    sectionsOf: outputSections,
    mutableOf: (s) => s._constraints?.mutable,
  });

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <SettingsForm
        title="Output settings"
        description="Format of the composited program output."
        editor={editor}
        meta={meta}
        variant="card"
      />
    </div>
  );
}
