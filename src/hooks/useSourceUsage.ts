"use client";

import { useCallback, useEffect, useState } from "react";
import { useIntinorClient } from "./useIntinorClient";
import type { IntinorClient } from "@/lib/intinor-client";
import type { EncodersList, VideoMixersList } from "@/lib/intinor/types";

export interface UsageEntry {
  kind: "encoder" | "mixer";
  index: number;
  label: string;
}

async function fetchUsage(client: IntinorClient): Promise<Map<string, UsageEntry[]>> {
  const [encodersList, mixersList] = await Promise.all([
    client.getEncoders() as Promise<EncodersList>,
    client.getVideoMixers() as Promise<VideoMixersList>,
  ]);

  const [encoderSettings, mixerSettings] = await Promise.all([
    Promise.all(
      encodersList.encoders.map((e) => client.getEncoderSettings(e.index).catch(() => null)),
    ),
    Promise.all(
      mixersList.video_mixers.map((m) => client.getVideoMixerSettings(m.index).catch(() => null)),
    ),
  ]);

  const map = new Map<string, UsageEntry[]>();
  const add = (source: string | undefined, entry: UsageEntry) => {
    if (!source) return;
    const list = map.get(source) ?? [];
    list.push(entry);
    map.set(source, list);
  };

  encodersList.encoders.forEach((e, i) => {
    add(encoderSettings[i]?.video_source?.source, {
      kind: "encoder",
      index: e.index,
      label: `Encoder #${e.index}`,
    });
  });

  mixersList.video_mixers.forEach((m, i) => {
    for (const layer of mixerSettings[i]?.program?.layers ?? []) {
      add(layer.input?.source, { kind: "mixer", index: m.index, label: `Mixer #${m.index}` });
    }
  });

  return map;
}

/**
 * Cross-references every encoder's `video_source.source` and every mixer's
 * layer sources for the current unit, so the settings pages can flag "this
 * input/mixer is already feeding something else" — a heads-up, never a
 * block; the unit itself has no rule against fan-out.
 *
 * One-shot (not polled) — it fetches every encoder's and mixer's settings
 * once on mount/unit change, since this is for the editing pages, not the
 * live status view. Call `refresh()` after a save so the picker reflects it.
 */
export function useSourceUsage() {
  const client = useIntinorClient();
  const [usage, setUsage] = useState<Map<string, UsageEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchUsage(client)
      .then((map) => {
        if (!cancelled) setUsage(map);
      })
      .catch(() => {
        if (!cancelled) setUsage(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const refresh = useCallback(() => {
    return fetchUsage(client)
      .then((map) => setUsage(map))
      .catch(() => setUsage(new Map()));
  }, [client]);

  return { usage, loading, refresh };
}

/** `usage` with one consumer's own entry excluded, and reduced to display labels. */
export function usageLabelsExcluding(
  usage: Map<string, UsageEntry[]>,
  exclude: { kind: UsageEntry["kind"]; index: number },
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [source, entries] of usage) {
    const others = entries.filter((e) => !(e.kind === exclude.kind && e.index === exclude.index));
    if (others.length > 0) out.set(source, others.map((e) => e.label));
  }
  return out;
}
