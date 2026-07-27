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
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Confirm changes</h2>
          <p className="text-sm text-slate-400">
            {writeMode === "mock"
              ? "Mock mode — this writes to the in-memory mock, not the real unit."
              : `These fields will be changed on ${unitId ?? "the unit"}.`}
          </p>
        </div>

        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {changes.map((c) => (
            <li key={c.path} className="rounded border border-slate-800 bg-slate-950/60 p-2">
              <div className="text-sm text-slate-200">{c.label}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400 line-through">
                  {c.from}
                </span>
                <span className="text-slate-500">→</span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                  {c.to}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-600">{c.path}</div>
            </li>
          ))}
        </ul>

        {conflicts.length > 0 && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
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
            <p className="text-xs text-red-300">
              Live unit with writes enabled — type <code className="rounded bg-slate-800 px-1">SAVE</code> to
              apply.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="SAVE"
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={
              "rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 " +
              (needsTypeToConfirm
                ? "bg-red-600 hover:bg-red-500"
                : "bg-sky-600 hover:bg-sky-500")
            }
          >
            {saving ? "Saving…" : `Save ${changes.length} change${changes.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
