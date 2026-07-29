"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IntinorApiError } from "@/lib/intinor-client";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useCurrentUnit } from "@/lib/units/context";
import { useSourceUsage, usageLabelsExcluding } from "@/hooks/useSourceUsage";
import type {
  NetworkInputsList,
  VideoMixerSettingsResponse,
  VideoMixersList,
} from "@/lib/intinor/types";
import {
  buildPresetLayers,
  type EditableLayer,
  isFeedSource,
  layoutConstraintsFrom,
  maxLayersFrom,
  PRESETS,
  prepareMixerPut,
  slotCoverage,
  sourceOptionsFrom,
  stripEnabled,
  withEnabled,
} from "@/lib/mixer-layout";
import {
  deleteProfile as deleteProfileStore,
  loadProfiles,
  saveProfile,
  type MixerProfile,
} from "@/lib/mixer-profiles";
import { MixerCanvas } from "@/components/mixer/MixerCanvas";
import { LayerEditor } from "@/components/mixer/LayerEditor";
import { LayoutProfiles } from "@/components/mixer/LayoutProfiles";
import { MixerPreview } from "@/components/mixer/MixerPreview";
import { MixerOutputSettings } from "@/components/mixer/MixerOutputSettings";
import { PipePicker } from "@/components/settings/PipePicker";
import type { UnitMeta } from "@/hooks/useUnitMeta";

type ApplyState = "idle" | "confirming" | "applying" | "done" | "error";

export default function MixerBuilderPage() {
  const client = useIntinorClient();
  const [mixerList, setMixerList] = useState<VideoMixersList | null>(null);
  const [selectedMixer, setSelectedMixer] = useState<number | null>(null);
  const [networkInputs, setNetworkInputs] = useState<NetworkInputsList | null>(null);
  const [meta, setMeta] = useState<UnitMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mixers, inputs, metaRes] = await Promise.all([
          client.getVideoMixers() as Promise<VideoMixersList>,
          client.getNetworkInputs() as Promise<NetworkInputsList>,
          fetch("/api/meta").then((r) => r.json() as Promise<UnitMeta>),
        ]);
        if (cancelled) return;
        setMixerList(mixers);
        setNetworkInputs(inputs);
        setMeta(metaRes);
        setSelectedMixer(mixers.video_mixers[0]?.index ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof IntinorApiError
            ? `${err.message} (HTTP ${err.status})`
            : err instanceof Error
              ? err.message
              : "Failed to load mixers",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-slate-100">Video mixer</h1>
        <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!mixerList || !networkInputs) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-slate-100">Video mixer</h1>
        <p className="mt-4 text-sm text-slate-500">Loading mixers…</p>
      </div>
    );
  }

  if (mixerList.video_mixers.length === 0 || selectedMixer == null) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-slate-100">Video mixer</h1>
        <p className="mt-4 text-sm text-slate-500">This unit has no video mixers.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Video mixer builder</h1>
        <p className="text-sm text-slate-500">
          Drag boxes to position layers, drag the corner to resize. Pick a preset,
          assign sources, save a named profile, then apply.
        </p>
      </div>

      <PipePicker
        label="Mixer"
        items={mixerList.video_mixers}
        selected={selectedMixer}
        onSelect={setSelectedMixer}
      />

      <MixerEditor
        key={selectedMixer}
        mixerIndex={selectedMixer}
        networkInputs={networkInputs}
        meta={meta}
      />
    </div>
  );
}

function MixerEditor({
  mixerIndex,
  networkInputs,
  meta,
}: {
  mixerIndex: number;
  networkInputs: NetworkInputsList;
  meta: UnitMeta | null;
}) {
  const client = useIntinorClient();
  const { unitId: currentUnitId } = useCurrentUnit();
  const unitId = currentUnitId ?? "unit";
  const { usage, refresh: refreshUsage } = useSourceUsage();

  const [settings, setSettings] = useState<VideoMixerSettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [layers, setLayers] = useState<EditableLayer[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<MixerProfile[]>([]);

  const [applyState, setApplyState] = useState<ApplyState>("idle");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [previewKey, setPreviewKey] = useState(0);

  const loadSettings = useCallback(async () => {
    const s = await client.getVideoMixerSettings(mixerIndex);
    setSettings(s);
    const editable = withEnabled(s.program?.layers ?? []);
    setLayers(editable);
    setSelectedIndex(editable.length > 0 ? 0 : null);
  }, [client, mixerIndex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSettings();
        if (cancelled) return;
        setProfiles(loadProfiles(unitId, mixerIndex));
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof IntinorApiError
            ? `${err.message} (HTTP ${err.status})`
            : err instanceof Error
              ? err.message
              : "Failed to load mixer",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSettings, unitId, mixerIndex]);

  const programConstraints = settings?._constraints?.program;
  const layoutConstraints = useMemo(
    () => layoutConstraintsFrom(programConstraints),
    [programConstraints],
  );
  const sourceOptions = useMemo(
    () => sourceOptionsFrom(programConstraints),
    [programConstraints],
  );
  const maxLayers = maxLayersFrom(programConstraints);

  // Every other encoder/mixer already using a given source, excluding this mixer's own layers.
  const sourceUsage = useMemo(
    () => usageLabelsExcluding(usage, { kind: "mixer", index: mixerIndex }),
    [usage, mixerIndex],
  );

  // Which feed sources are currently backed by an active input.
  const availableFeeds = useMemo(() => {
    const activeSuffixes = new Set(
      (networkInputs?.network_inputs ?? [])
        .filter((n) => n.active)
        .map((n) => n.href.replace(/^.*(\/network_inputs\/\d+)$/, "$1")),
    );
    const set = new Set<string>();
    for (const opt of sourceOptions) {
      if (!opt.value || !isFeedSource(opt.value)) continue;
      const suffix = opt.value.replace(/^.*(\/(?:network_inputs|video_inputs)\/\d+)$/, "$1");
      if (activeSuffixes.has(suffix)) set.add(opt.value);
    }
    return set;
  }, [networkInputs, sourceOptions]);

  const fillerSource = useMemo(() => {
    const test = sourceOptions.find((o) => o.value && /test_picture/.test(o.value));
    return test?.value ?? sourceOptions[0]?.value ?? "";
  }, [sourceOptions]);

  const feedSources = useMemo(
    () =>
      sourceOptions
        .filter((o) => o.value && isFeedSource(o.value) && availableFeeds.has(o.value))
        .map((o) => o.value as string),
    [sourceOptions, availableFeeds],
  );

  // Disabled layers are kept configured but aren't part of what's actually applied.
  const enabledLayers = useMemo(() => layers.filter((l) => l.enabled), [layers]);
  const disabledIndexes = useMemo(
    () => new Set(layers.flatMap((l, i) => (l.enabled ? [] : [i]))),
    [layers],
  );

  const coverage = useMemo(
    () => slotCoverage(enabledLayers, availableFeeds),
    [enabledLayers, availableFeeds],
  );

  const dirty = useMemo(() => {
    const saved = withEnabled(settings?.program?.layers ?? []);
    return JSON.stringify(layers) !== JSON.stringify(saved);
  }, [layers, settings]);

  // -- editing operations --------------------------------------------------
  const setLayout = (i: number, layout: { x: number; y: number; zoom: number }) =>
    setLayers((prev) => prev.map((l, j) => (j === i ? { ...l, layout } : l)));

  const setSource = (i: number, source: string) =>
    setLayers((prev) => prev.map((l, j) => (j === i ? { ...l, input: { ...l.input, source } } : l)));

  const toggleEnabled = (i: number) =>
    setLayers((prev) => prev.map((l, j) => (j === i ? { ...l, enabled: !l.enabled } : l)));

  const reorder = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= layers.length) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSelectedIndex(j);
  };

  const deleteLayer = (i: number) => {
    setLayers((prev) => prev.filter((_, j) => j !== i));
    setSelectedIndex((sel) => (sel == null ? null : sel === i ? null : sel > i ? sel - 1 : sel));
  };

  const addLayer = () => {
    if (layers.length >= maxLayers) return;
    setLayers((prev) => [
      ...prev,
      { layout: { x: 0.25, y: 0.25, zoom: 0.5 }, input: { source: fillerSource }, enabled: true },
    ]);
    setSelectedIndex(layers.length);
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setLayers(withEnabled(buildPresetLayers(preset, feedSources, fillerSource)));
    setSelectedIndex(0);
  };

  // -- profiles ------------------------------------------------------------
  const onSaveProfile = (name: string) => {
    setProfiles(saveProfile(unitId, mixerIndex, name, layers));
  };
  const onApplyProfile = (p: MixerProfile) => {
    setLayers(withEnabled(p.layers));
    setSelectedIndex(p.layers.length > 0 ? 0 : null);
  };
  const onDeleteProfile = (id: string) => {
    setProfiles(deleteProfileStore(unitId, mixerIndex, id));
  };

  // -- apply to unit -------------------------------------------------------
  const doApply = useCallback(async () => {
    if (!settings) return;
    setApplyState("applying");
    setApplyError(null);
    try {
      const body = prepareMixerPut(settings, stripEnabled(enabledLayers));
      await client.putVideoMixerSettings(mixerIndex, body);
      await loadSettings();
      void refreshUsage();
      setPreviewKey((k) => k + 1);
      setApplyState("done");
      setConfirmText("");
      setTimeout(() => setApplyState("idle"), 2500);
    } catch (err) {
      setApplyState("error");
      setApplyError(
        err instanceof IntinorApiError
          ? `${err.message} (HTTP ${err.status})`
          : err instanceof Error
            ? err.message
            : "Apply failed",
      );
    }
  }, [client, mixerIndex, settings, enabledLayers, loadSettings, refreshUsage]);

  const liveWrite = meta ? !meta.mock && meta.writesAllowed : false;
  const liveReadOnly = meta ? !meta.mock && !meta.writesAllowed : false;

  const onApplyClick = () => {
    if (liveWrite) {
      setApplyState("confirming");
    } else {
      void doApply();
    }
  };

  if (error) {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!settings) {
    return <p className="text-sm text-slate-500">Loading mixer #{mixerIndex}…</p>;
  }

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            title={p.description}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Slot coverage banner */}
      <SlotBanner
        total={coverage.total}
        liveFeeds={coverage.liveFeeds}
        fillers={coverage.fillers}
        empty={coverage.empty}
        feedCount={feedSources.length}
        disabledCount={layers.length - enabledLayers.length}
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Editing canvas {dirty && <span className="text-amber-400">· unsaved edits</span>}
            </div>
            <MixerCanvas
              layers={layers}
              selectedIndex={selectedIndex}
              constraints={layoutConstraints}
              availableFeeds={availableFeeds}
              disabledIndexes={disabledIndexes}
              onSelect={setSelectedIndex}
              onChangeLayout={setLayout}
            />
          </div>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Live program output
            </div>
            <MixerPreview index={mixerIndex} refreshKey={previewKey} />
          </div>
        </div>

        <div className="space-y-5">
          <LayerEditor
            layers={layers}
            selectedIndex={selectedIndex}
            constraints={layoutConstraints}
            sourceOptions={sourceOptions}
            availableFeeds={availableFeeds}
            maxLayers={maxLayers}
            sourceUsage={sourceUsage}
            onSelect={setSelectedIndex}
            onChangeLayout={setLayout}
            onChangeSource={setSource}
            onToggleEnabled={toggleEnabled}
            onReorder={reorder}
            onDelete={deleteLayer}
            onAdd={addLayer}
          />

          <LayoutProfiles
            profiles={profiles}
            onSave={onSaveProfile}
            onApply={onApplyProfile}
            onDelete={onDeleteProfile}
          />

          <MixerOutputSettings
            index={mixerIndex}
            meta={meta}
            onSaved={() => setPreviewKey((k) => k + 1)}
          />

          {/* Apply */}
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="text-sm font-medium text-slate-300">Apply to mixer</div>

            {meta?.mock && (
              <p className="text-xs text-amber-300/90">
                Mock mode — applying writes to the in-memory mock and updates the
                preview. The real unit is never touched.
              </p>
            )}
            {liveReadOnly && (
              <p className="text-xs text-sky-300/90">
                Live unit, read-only. Applying is blocked by the proxy until
                writes are explicitly enabled after review.
              </p>
            )}
            {liveWrite && (
              <p className="text-xs text-red-300/90">
                Live unit with writes enabled — applying changes the real program
                composition on {unitId}.
              </p>
            )}
            {layers.length > enabledLayers.length && (
              <p className="text-xs text-slate-500">
                {layers.length - enabledLayers.length} disabled layer
                {layers.length - enabledLayers.length === 1 ? "" : "s"} kept configured but won&apos;t
                be sent.
              </p>
            )}

            {applyState === "confirming" ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-300">
                  Type <code className="rounded bg-slate-800 px-1">APPLY</code> to
                  change the live program on {unitId}.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                  placeholder="APPLY"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void doApply()}
                    disabled={confirmText !== "APPLY"}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    Confirm apply
                  </button>
                  <button
                    onClick={() => {
                      setApplyState("idle");
                      setConfirmText("");
                    }}
                    className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={onApplyClick}
                disabled={applyState === "applying" || liveReadOnly || enabledLayers.length === 0}
                className="w-full rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
              >
                {applyState === "applying"
                  ? "Applying…"
                  : meta?.mock
                    ? "Apply to mock mixer"
                    : "Apply to unit"}
              </button>
            )}

            {applyState === "done" && (
              <p className="text-xs text-emerald-400">Applied. Preview updated.</p>
            )}
            {applyState === "error" && applyError && (
              <p className="text-xs text-red-300">{applyError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotBanner({
  total,
  liveFeeds,
  fillers,
  empty,
  feedCount,
  disabledCount,
}: {
  total: number;
  liveFeeds: number;
  fillers: number;
  empty: number;
  feedCount: number;
  disabledCount: number;
}) {
  if (total === 0 && disabledCount === 0) return null;
  return (
    <div className="rounded border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-slate-300">
      {total > 0 && (
        <>
          <strong className="text-slate-100">
            {liveFeeds} of {total} slot{total === 1 ? "" : "s"}
          </strong>{" "}
          {liveFeeds === 1 ? "has" : "have"} a live source.
          {fillers > 0 && ` ${fillers} use the test picture / filler.`}
          {empty > 0 && ` ${empty} have no source.`}{" "}
        </>
      )}
      {disabledCount > 0 && (
        <span className="text-slate-400">
          {disabledCount} layer{disabledCount === 1 ? "" : "s"} disabled, not counted above.{" "}
        </span>
      )}
      <span className="text-slate-500">
        This unit currently exposes {feedCount} live feed{feedCount === 1 ? "" : "s"}
        — extra quad cells fill with the test picture until more inputs (a second
        unit or licence upgrade) come online.
      </span>
    </div>
  );
}
