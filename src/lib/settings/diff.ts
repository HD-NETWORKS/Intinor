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
  return changes;
}
