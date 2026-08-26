"use client";

import { useState } from "react";
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
  const [passwordVisible, setPasswordVisible] = useState(false);

  const controlClass =
    "w-full rounded border px-2 py-1 text-sm " +
    (editable
      ? "border-border-strong bg-page text-body"
      : "cursor-not-allowed border-border-default bg-panel text-faint");

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {spec.label}
        {!editable && (
          <span
            className="rounded bg-panel-hover px-1 text-[10px] text-muted"
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
          className="h-4 w-4 self-start accent-brand-500 disabled:opacity-50"
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
      ) : spec.kind === "password" ? (
        <div className="relative">
          <input
            type={passwordVisible ? "text" : "password"}
            value={raw == null ? "" : String(raw)}
            disabled={!editable}
            onChange={(e) => onChange(spec.path, e.target.value)}
            className={controlClass + " pr-8"}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((v) => !v)}
            tabIndex={-1}
            title={passwordVisible ? "Hide" : "Show"}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-faint hover:text-body"
          >
            {passwordVisible ? "🙈" : "👁"}
          </button>
        </div>
      ) : (
        <input
          type={spec.kind === "number" ? "number" : "text"}
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

      {spec.help && <span className="text-[11px] text-faint">{spec.help}</span>}
    </label>
  );
}
