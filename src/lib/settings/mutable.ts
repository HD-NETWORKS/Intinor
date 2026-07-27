/**
 * Field-level permission matching against `_constraints.mutable`.
 *
 * The unit reports which fields the *logged-in user* may change as a list of
 * dot/bracket paths, per docs/01-intinor-api-reference.md §Access restrictions:
 *
 *   "mutable": ["video_source.source", "video_source.program_id",
 *               "destinations[].active"]
 *   "mutable": ["*"]   → everything writable
 *   "mutable": []      → everything read-only for this user
 *
 * This module is the single place that decides whether a form field is
 * editable. It is deliberately **fail-safe**: anything we cannot positively
 * prove is mutable is treated as read-only, because the alternative on a live
 * broadcast unit is offering an edit that the API will reject (or worse,
 * that succeeds when it shouldn't have been offered).
 */

/** `destinations[0].active` → `destinations[].active` */
export function normalizePath(path: string): string {
  return path.replace(/\[\d+\]/g, "[]");
}

/** True when `ancestor` names a parent of `path` (so a grant cascades down). */
function isAncestorOf(ancestor: string, path: string): boolean {
  if (!path.startsWith(ancestor)) return false;
  const next = path.charAt(ancestor.length);
  return next === "." || next === "[";
}

/**
 * Can the current user change the field at `path`?
 *
 * `mutable === undefined` means the unit didn't tell us — we return false and
 * callers surface a "permissions unknown, treating as read-only" notice rather
 * than silently enabling everything.
 */
export function isMutable(path: string, mutable: string[] | undefined): boolean {
  if (!mutable || mutable.length === 0) return false;
  if (mutable.includes("*")) return true;

  const target = normalizePath(path);
  return mutable.some((entry) => {
    const e = normalizePath(entry);
    return e === target || isAncestorOf(e, target);
  });
}

/**
 * Does anything under `prefix` remain editable? Used to decide whether a whole
 * settings section is worth presenting as editable, or should be shown as a
 * read-only summary.
 */
export function hasMutableDescendant(
  prefix: string,
  mutable: string[] | undefined,
): boolean {
  if (!mutable || mutable.length === 0) return false;
  if (mutable.includes("*")) return true;

  const p = normalizePath(prefix);
  return mutable.some((entry) => {
    const e = normalizePath(entry);
    return e === p || isAncestorOf(e, p) || isAncestorOf(p, e);
  });
}

export type PermissionMode = "all" | "partial" | "none" | "unknown";

/** Coarse description of what this user may do to a settings resource. */
export function permissionMode(mutable: string[] | undefined): PermissionMode {
  if (!mutable) return "unknown";
  if (mutable.includes("*")) return "all";
  if (mutable.length === 0) return "none";
  return "partial";
}
