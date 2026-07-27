"use client";

import type { SettingsEditor } from "@/hooks/useSettingsEditor";
import { writeModeOf, type UnitMeta } from "@/hooks/useUnitMeta";
import { isMutable, permissionMode } from "@/lib/settings/mutable";
import { ConfirmChangesDialog } from "./ConfirmChangesDialog";
import { SettingsField } from "./SettingsField";

function PermissionBanner({ mutable }: { mutable: string[] | undefined }) {
  const mode = permissionMode(mutable);
  if (mode === "all") return null;

  const text =
    mode === "unknown"
      ? "This unit didn't report field permissions for this resource. Treating every field as read-only."
      : mode === "none"
        ? "Your account has read-only access to these settings. Every field is disabled."
        : "Your account can change only some of these fields. Locked fields are marked read-only.";

  return (
    <div
      className={
        "rounded border px-4 py-2 text-sm " +
        (mode === "partial"
          ? "border-slate-700 bg-slate-900/60 text-slate-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-300")
      }
    >
      {text}
    </div>
  );
}

export function SettingsForm<T extends object>({
  title,
  description,
  editor,
  meta,
  /** "card" drops the page heading + sticky save bar so the form can sit
   *  inside another page (e.g. beside the mixer layout builder). */
  variant = "page",
}: {
  title: string;
  description?: string;
  editor: SettingsEditor<T>;
  meta: UnitMeta | null;
  variant?: "page" | "card";
}) {
  const writeMode = writeModeOf(meta);
  const { draft, mutable, sections, loading, error, changes, dirty, stage } = editor;

  const compact = variant === "card";

  if (error) {
    return (
      <div className={compact ? "" : "mx-auto max-w-4xl"}>
        <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (loading || !draft) {
    return (
      <div className={compact ? "" : "mx-auto max-w-4xl"}>
        <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-4 text-sm text-slate-500">Loading settings…</p>
      </div>
    );
  }

  const anyEditable = sections.some((s) =>
    s.fields.some((f) => isMutable(f.path, mutable)),
  );
  const saveBlocked = writeMode === "live-readonly";

  return (
    <div className={compact ? "space-y-3" : "mx-auto max-w-4xl space-y-5 pb-24"}>
      <div>
        {compact ? (
          <h2 className="font-medium text-slate-200">{title}</h2>
        ) : (
          <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        )}
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>

      <PermissionBanner mutable={mutable} />

      {sections.map((section) => (
        <section
          key={section.title}
          className={
            compact
              ? "space-y-3"
              : "space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4"
          }
        >
          <div className={compact ? "sr-only" : undefined}>
            <h2 className="font-medium text-slate-200">{section.title}</h2>
            {section.description && (
              <p className="text-xs text-slate-500">{section.description}</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.fields.map((spec) => (
              <SettingsField
                key={spec.path}
                spec={spec}
                draft={draft}
                mutable={mutable}
                onChange={editor.setField}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Save bar */}
      <div
        className={
          compact
            ? "border-t border-slate-800 pt-3"
            : "sticky bottom-0 -mx-6 border-t border-slate-800 bg-slate-950/95 px-6 py-3 backdrop-blur"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {saveBlocked ? (
              <span className="text-sky-300">
                Live unit, read-only mode — saving is disabled by the proxy.
              </span>
            ) : !anyEditable ? (
              <span className="text-slate-500">No editable fields for your account.</span>
            ) : dirty ? (
              <span className="text-amber-300">
                {changes.length} unsaved change{changes.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-slate-500">No changes.</span>
            )}
            {stage === "saved" && (
              <span className="ml-2 text-emerald-400">Saved.</span>
            )}
            {stage === "error" && editor.saveError && (
              <span className="ml-2 text-red-300">{editor.saveError}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={editor.reset}
              disabled={!dirty || stage === "saving"}
              className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Discard
            </button>
            <button
              onClick={() => void editor.beginSave()}
              disabled={!dirty || saveBlocked || stage === "saving"}
              className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Review &amp; save…
            </button>
          </div>
        </div>
      </div>

      {stage === "confirming" && (
        <ConfirmChangesDialog
          changes={changes}
          conflicts={editor.conflicts}
          writeMode={writeMode}
          unitId={meta?.unitId ?? null}
          saving={false}
          onConfirm={() => void editor.commit()}
          onCancel={editor.cancelSave}
        />
      )}
      {stage === "saving" && (
        <ConfirmChangesDialog
          changes={changes}
          conflicts={editor.conflicts}
          writeMode={writeMode}
          unitId={meta?.unitId ?? null}
          saving
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      )}
    </div>
  );
}
