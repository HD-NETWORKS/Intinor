"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { IntinorApiError } from "@/lib/intinor-client";
import { useUnitMeta, writeModeOf } from "@/hooks/useUnitMeta";
import type {
  CustomEncodingModesConstraintsAudioCodec,
  CustomEncodingModesConstraintsVideoCodec,
  EncodingMode,
  EncodingSettingsConstraints,
  EncodingSettingsRequest,
  EncodingSettingsResponse,
} from "@/lib/intinor/types";
import type { FieldSpec, SelectOption } from "@/lib/settings/fields";
import { optionsFromDescribed, optionsFromFormats } from "@/lib/settings/options";
import { diffSettings, type SettingsChange } from "@/lib/settings/diff";
import { buildPutBody, detectConflicts, type ConflictWarning } from "@/lib/settings/apply";
import { setAtPath } from "@/lib/settings/paths";
import { PermissionBanner } from "@/components/settings/SettingsForm";
import { SettingsField } from "@/components/settings/SettingsField";
import { ConfirmChangesDialog } from "@/components/settings/ConfirmChangesDialog";

/** Numeric description/value pairs (e.g. sample rates) don't fit SelectOption's string value. */
function numericOptions(list: Array<{ value?: number; description: string }> | undefined): SelectOption[] {
  return (list ?? [])
    .filter((o): o is { value: number; description: string } => typeof o.value === "number")
    .map((o) => ({ value: String(o.value), label: o.description }));
}

function globalFields(c: EncodingSettingsConstraints | undefined): FieldSpec[] {
  return [
    {
      path: "video_input.sd_aspect_ratio",
      label: "Default SD aspect ratio",
      kind: "select",
      options: optionsFromDescribed(c?.video_input?.sd_aspect_ratio),
    },
    {
      path: "builtin_encoding_modes.audio.tracks",
      label: "Built-in mode audio tracks",
      kind: "number",
      min: c?.builtin_encoding_modes?.audio?.tracks?.min,
      max: c?.builtin_encoding_modes?.audio?.tracks?.max,
    },
    {
      path: "builtin_encoding_modes.audio.downmix",
      label: "Built-in mode downmix",
      kind: "select",
      options: optionsFromDescribed(c?.builtin_encoding_modes?.audio?.downmix),
    },
  ];
}

/** Fields for one custom_encoding_modes[index] entry, ranges narrowed to its currently-selected codec. */
function customModeFields(
  mode: EncodingMode,
  index: number,
  c: EncodingSettingsConstraints | undefined,
): FieldSpec[] {
  const p = `custom_encoding_modes[${index}]`;
  const vc: CustomEncodingModesConstraintsVideoCodec | undefined =
    c?.custom_encoding_modes?.video_codecs?.find((v) => v.value === mode.video.codec);
  const ac: CustomEncodingModesConstraintsAudioCodec | undefined =
    c?.custom_encoding_modes?.audio_codecs?.find((a) => a.value === mode.audio.codec);

  return [
    { path: `${p}.description`, label: "Description", kind: "text" },
    {
      path: `${p}.group_description`,
      label: "Group label",
      kind: "text",
      help: "Shown as a heading in the encoding-mode dropdown on encoder settings pages.",
    },
    {
      path: `${p}.video.codec`,
      label: "Video codec",
      kind: "select",
      options: optionsFromDescribed(c?.custom_encoding_modes?.video_codecs),
    },
    {
      path: `${p}.video.format`,
      label: "Format",
      kind: "select",
      options: optionsFromFormats(vc?.format),
    },
    {
      path: `${p}.video.bitrate`,
      label: "Video bitrate",
      kind: "number",
      unit: "bit/s",
      min: vc?.bitrate?.min,
      max: vc?.bitrate?.max,
    },
    {
      path: `${p}.video.gop`,
      label: "Max GOP",
      kind: "number",
      min: vc?.gop?.min,
      max: vc?.gop?.max,
    },
    {
      path: `${p}.video.chroma`,
      label: "Chroma",
      kind: "select",
      options: optionsFromDescribed(vc?.chroma),
    },
    {
      path: `${p}.video.profile`,
      label: "Profile",
      kind: "select",
      options: optionsFromDescribed(vc?.profile),
    },
    {
      path: `${p}.video.level`,
      label: "Level",
      kind: "select",
      options: optionsFromDescribed(vc?.level),
    },
    ...(vc?.latency_quality_mode
      ? [
          {
            path: `${p}.video.latency_quality_mode`,
            label: "Latency/quality mode",
            kind: "select" as const,
            options: optionsFromDescribed(vc.latency_quality_mode),
          },
        ]
      : []),
    ...(vc?.capabilities?.scene_change_detection
      ? [
          {
            path: `${p}.video.scene_change_detection`,
            label: "Scene change detection",
            kind: "checkbox" as const,
          },
        ]
      : []),
    {
      path: `${p}.audio.codec`,
      label: "Audio codec",
      kind: "select",
      options: optionsFromDescribed(c?.custom_encoding_modes?.audio_codecs),
    },
    {
      path: `${p}.audio.bitrate`,
      label: "Audio bitrate",
      kind: "number",
      unit: "bit/s",
      min: ac?.bitrate?.min,
      max: ac?.bitrate?.max,
    },
    {
      path: `${p}.audio.tracks`,
      label: "Audio tracks",
      kind: "number",
      min: ac?.tracks?.min,
      max: ac?.tracks?.max,
    },
    ...(ac?.samplerate
      ? [
          {
            path: `${p}.audio.samplerate`,
            label: "Sample rate",
            kind: "select" as const,
            options: numericOptions(ac.samplerate),
          },
        ]
      : []),
    ...(ac?.downmix
      ? [
          {
            path: `${p}.audio.downmix`,
            label: "Downmix",
            kind: "select" as const,
            options: optionsFromDescribed(ac.downmix),
          },
        ]
      : []),
  ];
}

/** A fresh custom mode seeded from the first available codec options, so it's immediately valid. */
function templateCustomMode(c: EncodingSettingsConstraints | undefined): EncodingMode {
  const vc = c?.custom_encoding_modes?.video_codecs?.[0];
  const ac = c?.custom_encoding_modes?.audio_codecs?.[0];
  return {
    // Placeholder client-side id — the unit assigns/validates the real one on save.
    id: `custom-${Date.now()}`,
    description: "New custom mode",
    group: "custom",
    group_description: "Custom",
    video: {
      codec: vc?.value ?? "h264",
      format: vc?.format?.[0]?.value ?? "1920x1080p/25",
      bitrate: vc?.bitrate?.min ?? 4_000_000,
      profile: vc?.profile?.[0]?.value ?? "main",
      level: vc?.level?.[0]?.value ?? "4.0",
      gop: vc?.gop?.min ?? 50,
      chroma: vc?.chroma?.[0]?.value ?? "4:2:0",
    },
    audio: {
      codec: ac?.value ?? "aac",
      bitrate: ac?.bitrate?.min ?? 128_000,
      tracks: ac?.tracks?.min ?? 1,
      samplerate: ac?.samplerate?.[0]?.value ?? 48000,
    },
  };
}

function describe(err: unknown, fallback: string): string {
  if (err instanceof IntinorApiError) return `${err.message} (HTTP ${err.status})`;
  if (err instanceof Error) return err.message;
  return fallback;
}

type SaveStage = "idle" | "confirming" | "saving" | "saved" | "error";

export default function EncodingModesPage() {
  const client = useIntinorClient();
  const meta = useUnitMeta();
  const writeMode = writeModeOf(meta);

  const [original, setOriginal] = useState<EncodingSettingsResponse | null>(null);
  const [draft, setDraft] = useState<EncodingSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<SaveStage>("idle");
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<EncodingSettingsResponse | null>(null);

  // Custom modes start collapsed — a unit with many of them turns into a huge
  // wall of fields otherwise. The quick-jump chip row below expands + scrolls
  // to whichever one you actually want.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = useCallback((i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);
  const jumpTo = useCallback((i: number) => {
    setExpanded((prev) => new Set(prev).add(i));
    requestAnimationFrame(() => {
      document.getElementById(`custom-mode-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const load = useCallback(() => client.getEncodingSettings(), [client]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((s) => {
        if (cancelled) return;
        setOriginal(s);
        setDraft(structuredClone(s));
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(describe(err, "Failed to load encoding settings"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const mutable = original?._constraints?.mutable;

  // Specs are recomputed from `draft` (not `original`, unlike the other settings
  // pages) so a codec change immediately narrows the format/bitrate/profile/etc.
  // options for that mode — there's no fixed array length to key a one-time
  // computation off, since modes can be added or removed.
  const specs = useMemo(() => {
    if (!draft) return [];
    return [
      ...globalFields(draft._constraints),
      ...draft.custom_encoding_modes.flatMap((m, i) => customModeFields(m, i, draft._constraints)),
    ];
  }, [draft]);

  const lengthChanged =
    original && draft && original.custom_encoding_modes.length !== draft.custom_encoding_modes.length;

  const changes = useMemo<SettingsChange[]>(() => {
    if (!original || !draft) return [];
    const allFieldChanges = diffSettings(original, draft, specs);
    if (!lengthChanged) return allFieldChanges;
    // A mode was added or removed — that's a whole-array-length change with no
    // fixed set of per-mode field paths to diff against (an added mode has no
    // "before", a removed one has no "after"), so it's reported and applied as
    // one structural change covering the whole list instead of per field.
    return [
      ...allFieldChanges.filter((c) => !c.path.startsWith("custom_encoding_modes")),
      {
        path: "custom_encoding_modes",
        label: "Custom encoding modes",
        from: `${original.custom_encoding_modes.length} mode(s)`,
        to: `${draft.custom_encoding_modes.length} mode(s)`,
        value: draft.custom_encoding_modes,
      },
    ];
  }, [original, draft, specs, lengthChanged]);

  const dirty = changes.length > 0;

  const setField = useCallback((path: string, value: unknown) => {
    setDraft((prev) => (prev ? setAtPath(prev, path, value) : prev));
  }, []);

  const addMode = useCallback(() => {
    if (!draft) return;
    const newIndex = draft.custom_encoding_modes.length;
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            custom_encoding_modes: [...prev.custom_encoding_modes, templateCustomMode(prev._constraints)],
          }
        : prev,
    );
    // Open the freshly-added mode immediately — collapsed-by-default is right
    // for existing modes you're just browsing, not for one you just created.
    setExpanded((exp) => new Set(exp).add(newIndex));
  }, [draft]);

  const removeMode = useCallback((index: number) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            custom_encoding_modes: prev.custom_encoding_modes.filter((_, i) => i !== index),
          }
        : prev,
    );
    // Removing a mode shifts every later index down by one — keep `expanded`
    // pointing at the same modes rather than whatever now occupies that slot.
    setExpanded((exp) => {
      const next = new Set<number>();
      for (const i of exp) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setDraft(original ? structuredClone(original) : null);
    setStage("idle");
    setSaveError(null);
    setConflicts([]);
  }, [original]);

  const beginSave = useCallback(async () => {
    if (!original || changes.length === 0) return;
    setSaveError(null);
    try {
      const current = await load();
      setFresh(current);
      setConflicts(detectConflicts(original, current, changes));
      setStage("confirming");
    } catch (err) {
      setSaveError(describe(err, "Could not re-read settings before saving"));
      setStage("error");
    }
  }, [original, changes, load]);

  const cancelSave = useCallback(() => {
    setStage("idle");
    setConflicts([]);
    setFresh(null);
  }, []);

  const commit = useCallback(async () => {
    if (!fresh || changes.length === 0) return;
    setStage("saving");
    setSaveError(null);
    try {
      await client.putEncodingSettings(
        buildPutBody(fresh, changes) as EncodingSettingsRequest,
      );
      const reloaded = await load();
      setOriginal(reloaded);
      setDraft(structuredClone(reloaded));
      setConflicts([]);
      setFresh(null);
      setStage("saved");
    } catch (err) {
      setSaveError(describe(err, "Save failed"));
      setStage("error");
    }
  }, [fresh, changes, client, load]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (loading || !draft) {
    return <p className="text-sm text-faint">Loading encoding settings…</p>;
  }

  const saveBlocked = writeMode === "live-readonly";

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-semibold text-fg">Encoding modes</h1>
        <p className="text-xs text-faint">
          Global encoding defaults, and the unit&apos;s custom encoding mode presets — the
          same list encoders pick from in their &quot;Encoding mode&quot; dropdown. Built-in
          modes are fixed by firmware and shown read-only.
        </p>
      </div>

      <PermissionBanner mutable={mutable} />

      <section className="space-y-3 rounded-lg border border-border-default bg-panel p-4">
        <h2 className="font-medium text-body">Global</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {globalFields(draft._constraints).map((spec) => (
            <SettingsField key={spec.path} spec={spec} draft={draft} mutable={mutable} onChange={setField} />
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Custom encoding modes ({draft.custom_encoding_modes.length})
        </h2>
        <div className="flex gap-2">
          {draft.custom_encoding_modes.length > 1 && (
            <button
              onClick={() =>
                setExpanded((prev) =>
                  prev.size > 0 ? new Set() : new Set(draft.custom_encoding_modes.map((_, i) => i)),
                )
              }
              className="rounded border border-border-strong px-3 py-1 text-xs text-body hover:bg-panel-hover"
            >
              {expanded.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          )}
          <button
            onClick={addMode}
            disabled={saveBlocked}
            className="rounded border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-xs text-accent hover:bg-sky-500/20 disabled:opacity-40"
          >
            + Add mode
          </button>
        </div>
      </div>

      {draft.custom_encoding_modes.length === 0 && (
        <p className="text-sm text-faint">No custom encoding modes defined.</p>
      )}

      {/* Quick-jump nav — expands and scrolls to a mode, useful once there are more than a couple. */}
      {draft.custom_encoding_modes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {draft.custom_encoding_modes.map((mode, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              className="rounded border border-border-strong px-3 py-1 text-xs text-body hover:bg-panel-hover"
            >
              {mode.description || `Custom mode ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {draft.custom_encoding_modes.map((mode, i) => {
        const isOpen = expanded.has(i);
        return (
          <section key={i} id={`custom-mode-${i}`} className="rounded-lg border border-border-default bg-panel scroll-mt-4">
            <div className="flex items-center justify-between gap-2 p-4">
              <button
                onClick={() => toggleExpanded(i)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span className="text-faint">{isOpen ? "▾" : "▸"}</span>
                <h3 className="font-medium text-body">
                  Custom mode {i + 1}
                  {mode.description ? ` — ${mode.description}` : ""}
                </h3>
              </button>
              <button
                onClick={() => removeMode(i)}
                disabled={saveBlocked}
                className="rounded border border-red-500/40 px-2 py-1 text-xs text-danger hover:bg-red-500/10 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
            {isOpen && (
              <div className="grid gap-3 border-t border-border-default p-4 sm:grid-cols-2">
                {customModeFields(mode, i, draft._constraints).map((spec) => (
                  <SettingsField key={spec.path} spec={spec} draft={draft} mutable={mutable} onChange={setField} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-4 border-t border-border-default bg-panel-strong px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {saveBlocked ? (
              <span className="text-accent">
                Live unit, read-only mode — saving is disabled by the proxy.
              </span>
            ) : dirty ? (
              <span className="text-warning">
                {changes.length} unsaved change{changes.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-faint">No changes.</span>
            )}
            {stage === "saved" && <span className="ml-2 text-success">Saved.</span>}
            {stage === "error" && saveError && <span className="ml-2 text-danger">{saveError}</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={!dirty || stage === "saving"}
              className="rounded border border-border-strong px-3 py-1.5 text-sm text-body hover:bg-panel-hover disabled:opacity-40"
            >
              Discard
            </button>
            <button
              onClick={() => void beginSave()}
              disabled={!dirty || saveBlocked || stage === "saving"}
              className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Review &amp; save…
            </button>
          </div>
        </div>
      </div>

      {(stage === "confirming" || stage === "saving") && (
        <ConfirmChangesDialog
          changes={changes}
          conflicts={conflicts}
          writeMode={writeMode}
          unitId={meta?.unitId ?? null}
          saving={stage === "saving"}
          onConfirm={() => void commit()}
          onCancel={cancelSave}
        />
      )}
    </div>
  );
}
