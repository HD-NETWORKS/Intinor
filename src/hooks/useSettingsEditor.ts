"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IntinorApiError } from "@/lib/intinor-client";
import { buildPutBody, detectConflicts, type ConflictWarning } from "@/lib/settings/apply";
import { diffSettings, type SettingsChange } from "@/lib/settings/diff";
import type { FieldSection, FieldSpec } from "@/lib/settings/fields";
import { setAtPath } from "@/lib/settings/paths";

export type SaveStage = "idle" | "confirming" | "saving" | "saved" | "error";

export interface SettingsEditor<T> {
  original: T | null;
  draft: T | null;
  mutable: string[] | undefined;
  /** Form layout derived from the loaded settings (options come from _constraints). */
  sections: FieldSection[];
  loading: boolean;
  error: string | null;

  changes: SettingsChange[];
  dirty: boolean;

  setField: (path: string, value: unknown) => void;
  reset: () => void;

  stage: SaveStage;
  conflicts: ConflictWarning[];
  saveError: string | null;
  /** Re-fetches, detects conflicts, and opens the confirmation diff. */
  beginSave: () => Promise<void>;
  cancelSave: () => void;
  /** Performs the actual PUT after the user confirms. */
  commit: () => Promise<void>;
}

function describe(err: unknown, fallback: string): string {
  if (err instanceof IntinorApiError) return `${err.message} (HTTP ${err.status})`;
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * GET → edit → (re-GET, confirm diff) → PUT lifecycle for one settings
 * resource. `load` is called both on mount and immediately before saving, so
 * the PUT is always built on top of the unit's current state with only the
 * user's own changed fields applied over it.
 */
export function useSettingsEditor<T extends object>(opts: {
  load: () => Promise<T>;
  save: (body: T) => Promise<unknown>;
  /** Built from the loaded settings so select options come from `_constraints`. */
  sectionsOf: (settings: T) => FieldSection[];
  mutableOf: (settings: T) => string[] | undefined;
}): SettingsEditor<T> {
  const { load, save, sectionsOf, mutableOf } = opts;

  const [original, setOriginal] = useState<T | null>(null);
  const [draft, setDraft] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<SaveStage>("idle");
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await load();
        if (cancelled) return;
        setOriginal(s);
        setDraft(structuredClone(s));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(describe(err, "Failed to load settings"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const mutable = useMemo(
    () => (original ? mutableOf(original) : undefined),
    [original, mutableOf],
  );

  const sections = useMemo(
    () => (original ? sectionsOf(original) : []),
    [original, sectionsOf],
  );
  const specs: FieldSpec[] = useMemo(
    () => sections.flatMap((s) => s.fields),
    [sections],
  );

  const changes = useMemo(
    () => (original && draft ? diffSettings(original, draft, specs) : []),
    [original, draft, specs],
  );

  const setField = useCallback((path: string, value: unknown) => {
    setDraft((prev) => (prev ? setAtPath(prev, path, value) : prev));
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
      // Re-read right before writing so the PUT is layered onto current state.
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
      await save(buildPutBody(fresh, changes));
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
  }, [fresh, changes, save, load]);

  return {
    original,
    draft,
    mutable,
    sections,
    loading,
    error,
    changes,
    dirty: changes.length > 0,
    setField,
    reset,
    stage,
    conflicts,
    saveError,
    beginSave,
    cancelSave,
    commit,
  };
}
