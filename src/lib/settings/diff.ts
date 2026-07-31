/**
 * Change detection between the pristine settings we loaded and the user's
 * draft, over the declared field specs. Drives both the "unsaved changes"
 * state and the pre-submit confirmation diff.
 */

import { displayValue, type FieldSpec } from "./fields";
import { getAtPath } from "./paths";

export interface SettingsChange {
  path: string;
  label: string;
  from: string;
  to: string;
  /** Raw drafted value, used when building the PUT body. */
  value: unknown;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Treat absent/empty-string as equivalent so untouched optional text fields
  // don't show up as spurious changes.
  const aEmpty = a === undefined || a === null || a === "";
  const bEmpty = b === undefined || b === null || b === "";
  if (aEmpty && bEmpty) return true;
  return false;
}

/** `destinations.basic[2].address` → `destinations.basic` */
function arrayBasePath(path: string): string | null {
  return path.match(/^(.+?)\[\d+\]/)?.[1] ?? null;
}

/** Friendlier names for the array roots resizable-list UIs actually use; falls back to the last path segment. */
const ARRAY_LABELS: Record<string, string> = {
  "destinations.basic": "Push destinations",
  "destinations.rtmp": "RTMP destinations",
  access_control: "Access rules",
  custom_encoding_modes: "Custom encoding modes",
};

function prettyLabel(path: string): string {
  if (ARRAY_LABELS[path]) return ARRAY_LABELS[path];
  const last = path.split(".").pop() ?? path;
  return last.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function diffSettings<T>(
  original: T,
  draft: T,
  specs: FieldSpec[],
): SettingsChange[] {
  const changes: SettingsChange[] = [];
  for (const spec of specs) {
    const before = getAtPath(original, spec.path);
    const after = getAtPath(draft, spec.path);
    if (sameValue(before, after)) continue;
    changes.push({
      path: spec.path,
      label: spec.label,
      from: displayValue(spec, before),
      to: displayValue(spec, after),
      value: after,
    });
  }

  // An added or removed array item (a destination, an access rule, …) has no
  // fixed set of per-field paths to diff against — a new item has no
  // "before", a removed one has no "after". Any array whose length differs
  // between original and draft collapses to one structural change covering
  // the whole array, replacing the (incomplete) per-field changes under it.
  const arrayPaths = new Set(
    specs.map((s) => arrayBasePath(s.path)).filter((p): p is string => p != null),
  );
  const resized = Array.from(arrayPaths).filter((p) => {
    const before = getAtPath(original, p);
    const after = getAtPath(draft, p);
    return Array.isArray(before) && Array.isArray(after) && before.length !== after.length;
  });
  if (resized.length === 0) return changes;

  const kept = changes.filter((c) => !resized.some((p) => c.path.startsWith(p)));
  const structural = resized.map((p) => {
    const before = getAtPath(original, p) as unknown[];
    const after = getAtPath(draft, p) as unknown[];
    return {
      path: p,
      label: prettyLabel(p),
      from: `${before.length} item(s)`,
      to: `${after.length} item(s)`,
      value: after,
    };
  });
  return [...kept, ...structural];
}
