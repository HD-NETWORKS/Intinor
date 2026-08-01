/**
 * The GET → modify → PUT step.
 *
 * We deliberately re-fetch immediately before writing and apply *only* the
 * fields the user actually changed onto that fresh copy. That way a concurrent
 * edit (someone in the stock IDM console, or another operator) isn't silently
 * clobbered by stale values sitting in our form — only the specific fields the
 * user touched are overwritten.
 *
 * Per the API's forward-compatibility rules we send unknown fields back
 * unmodified, strip `_constraints`/`_messages`/`_links`, and echo `_version`
 * when the unit provided one.
 */

import type { SettingsChange } from "./diff.ts";
import { getAtPath, setAtPath } from "./paths.ts";

export interface ConflictWarning {
  path: string;
  label: string;
  /** Value we loaded into the form. */
  loaded: string;
  /** Value the unit reports right now. */
  current: string;
}

/**
 * Fields that changed on the unit *underneath* the user since the form loaded.
 * Surfaced in the confirmation dialog so a stale overwrite is a conscious act.
 */
export function detectConflicts<T>(
  loadedOriginal: T,
  fresh: T,
  changes: SettingsChange[],
): ConflictWarning[] {
  const out: ConflictWarning[] = [];
  for (const change of changes) {
    const loaded = getAtPath(loadedOriginal, change.path);
    const current = getAtPath(fresh, change.path);
    if (JSON.stringify(loaded) !== JSON.stringify(current)) {
      out.push({
        path: change.path,
        label: change.label,
        loaded: String(loaded ?? "(empty)"),
        current: String(current ?? "(empty)"),
      });
    }
  }
  return out;
}

/** Build the PUT body: fresh settings + only the changed fields, meta stripped. */
export function buildPutBody<T extends object>(fresh: T, changes: SettingsChange[]): T {
  let body = structuredClone(fresh) as unknown as Record<string, unknown>;
  for (const change of changes) {
    body = setAtPath(body, change.path, change.value);
  }
  delete body._constraints;
  delete body._messages;
  delete body._links;
  return body as unknown as T;
}
