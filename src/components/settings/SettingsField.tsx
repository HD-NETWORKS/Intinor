"use client";

import type { FieldSpec } from "@/lib/settings/fields";
import { isMutable } from "@/lib/settings/mutable";
import { getAtPath } from "@/lib/settings/paths";

/**
 * One settings field. If the unit's `_constraints.mutable` doesn't grant this
 * exact path to the logged-in user, the control renders disabled with a lock
 * marker — the current value is still visible (useful), but it is never
 * presented as something you can change.
 */
export function SettingsField<T>({
  spec,
  draft,
  mutable,
  onChange,
}: {
  spec: FieldSpec;
  draft: T;
  mutable: string[] | undefined;
  onChange: (path: string, value: unknown) => void;
}) {
  const editable = isMutable(spec.path, mutable);
  const raw = getAtPath(draft, spec.path);

  const controlClass =
    "w-full rounded border px-2 py-1 text-sm " +
    (editable
      ? "border-slate-700 bg-slate-950 text-slate-200"
      : "cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500");

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        {spec.label}
        {!editable && (
          <span
            className="rounded bg-slate-800 px-1 text-[10px] text-slate-400"
            title="Read-only for your account — the unit did not grant this field in _constraints.mutable"
          >
            🔒 read-only
          </span>
        )}
      </span>

      {spec.kind === "checkbox" ? (
        <input
          type="checkbox"
          checked={Boolean(raw)}
          disabled={!editable}
          onChange={(e) => onChange(spec.path, e.target.checked)}
          className="h-4 w-4 self-start accent-sky-500 disabled:opacity-50"
        />
      ) : spec.kind === "select" ? (
        <select
          value={raw == null ? "" : String(raw)}
          disabled={!editable}
          onChange={(e) => onChange(spec.path, e.target.value)}
          className={controlClass}
        >
          {/* Keep the current value selectable even if the unit no longer
              lists it, so we never silently rewrite an unknown setting. */}
          {raw != null &&
            String(raw) !== "" &&
            !spec.options?.some((o) => o.value === String(raw)) && (
              <option value={String(raw)}>{String(raw)} (current)</option>
            )}
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.unavailable ? " (offline)" : ""}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={spec.kind === "number" ? "number" : spec.kind === "password" ? "password" : "text"}
          value={raw == null ? "" : String(raw)}
          disabled={!editable}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          onChange={(e) =>
            onChange(
              spec.path,
              spec.kind === "number"
                ? e.target.value === ""
                  ? undefined
                  : Number(e.target.value)
                : e.target.value,
            )
          }
          className={controlClass}
        />
      )}

      {spec.help && <span className="text-[11px] text-slate-500">{spec.help}</span>}
    </label>
  );
}
