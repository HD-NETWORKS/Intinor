/**
 * Adapters turning the unit's `_constraints` option lists into select options.
 * Every dropdown in the settings UI is populated from these — we never
 * hardcode a list of protocols/modes/sources the unit didn't offer.
 */

import type { SelectOption } from "./fields";

interface DescribedValue {
  value?: string;
  description?: string;
  name?: string;
}

export function optionsFromDescribed(list: DescribedValue[] | undefined): SelectOption[] {
  const seen = new Set<string>();
  return (list ?? [])
    .filter((o): o is DescribedValue & { value: string } => typeof o.value === "string")
    // Some constraint lists (e.g. destinations.protocol) repeat the same
    // value once per destination-group type ("srt" for both a push
    // destination and an on-request one) — same option, shown twice would
    // be a duplicate <option> and a duplicate React key. Keep the first.
    .filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)))
    .map((o) => ({ value: o.value, label: o.name ?? o.description ?? o.value }));
}

interface EncodingModeOption {
  id: string;
  value?: string;
  description: string;
  group_description?: string;
  total_bitrate?: number;
}

export function optionsFromEncodingModes(
  list: EncodingModeOption[] | undefined,
): SelectOption[] {
  return (list ?? []).map((m) => ({
    value: m.value ?? m.id,
    label: m.group_description ? `${m.group_description} · ${m.description}` : m.description,
  }));
}

interface VideoFormatOption {
  value?: string;
  description: string;
  resolution?: string;
  framerate?: number;
}

export function optionsFromFormats(list: VideoFormatOption[] | undefined): SelectOption[] {
  return (list ?? [])
    .filter((f): f is VideoFormatOption & { value: string } => typeof f.value === "string")
    .map((f) => ({ value: f.value, label: f.description || f.value }));
}
