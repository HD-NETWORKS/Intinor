"use client";

import { useState } from "react";
import type { ConflictWarning } from "@/lib/settings/apply";
import type { SettingsChange } from "@/lib/settings/diff";
import type { WriteMode } from "@/hooks/useUnitMeta";

/**
 * "You're about to change X from A to B" — shown before every settings write.
 * On a live unit with writes enabled it additionally requires typing SAVE,
 * because these fields carry a live broadcast.
 */
export function ConfirmChangesDialog({
  changes,
  conflicts,
  writeMode,
  unitId,
  saving,
  onConfirm,
  onCancel,
}: {
  changes: SettingsChange[];
  conflicts: ConflictWarning[];
  writeMode: WriteMode;
  unitId: string | null;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const needsTypeToConfirm = writeMode === "live-write";
  const canConfirm = !saving && (!needsTypeToConfirm || typed === "SAVE");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg space-y-4 rounded border border-border-strong bg-surface-solid p-5 shadow-xl">
        <div>
          <h2 className="text-base font-semibold text-fg">Confirm changes</h2>
          <p className="text-sm text-muted">
            {writeMode === "mock"
              ? "Mock mode — this writes to the in-memory mock, not the real unit."
              : `These fields will be changed on ${unitId ?? "the unit"}.`}
          </p>
        </div>

        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {changes.map((c) => (
            <li key={c.path} className="rounded border border-border-default bg-panel-strong p-2">
              <div className="text-sm text-body">{c.label}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-panel-hover px-1.5 py-0.5 text-muted line-through">
                  {c.from}
                </span>
                <span className="text-faint">→</span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-success">
                  {c.to}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-subtle">{c.path}</div>
            </li>
          ))}
        </ul>

        {conflicts.length > 0 && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-warning">
            <strong>Changed on the unit since you loaded this form:</strong>
            <ul className="mt-1 space-y-0.5">
              {conflicts.map((c) => (
                <li key={c.path}>
                  {c.label}: you loaded <code>{c.loaded}</code>, unit now has{" "}
                  <code>{c.current}</code>. Saving overwrites it.
                </li>
              ))}
            </ul>
          </div>
        )}

        {needsTypeToConfirm && (
          <div className="space-y-1">
            <p className="text-xs text-danger">
              Live unit with writes enabled — type <code className="rounded bg-panel-hover px-1">SAVE</code> to
              apply.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="SAVE"
              className="w-full rounded border border-border-strong bg-page px-2 py-1 text-sm text-body"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded border border-border-strong px-3 py-1.5 text-sm text-body hover:bg-panel-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={
              "rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 " +
              (needsTypeToConfirm
                ? "bg-signal-red-600 hover:bg-signal-red-500"
                : "bg-brand-600 hover:bg-brand-500")
            }
          >
            {saving ? "Saving…" : `Save ${changes.length} change${changes.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
