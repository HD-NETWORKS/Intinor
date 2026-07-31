"use client";

import type {
  VideoMixerLayerLayoutConstraints,
  VideoSourceConstraint,
} from "@/lib/intinor/types";
import { clampLayout, isFeedSource, type EditableLayer } from "@/lib/mixer-layout";
import { sourceLabel } from "./sourceLabel";

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-muted">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={0.05}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-border-strong bg-page px-2 py-1 text-sm text-body"
      />
    </label>
  );
}

export function LayerEditor({
  layers,
  selectedIndex,
  constraints,
  sourceOptions,
  availableFeeds,
  maxLayers,
  sourceUsage,
  onSelect,
  onChangeLayout,
  onChangeSource,
  onToggleEnabled,
  onReorder,
  onDelete,
  onAdd,
}: {
  layers: EditableLayer[];
  selectedIndex: number | null;
  constraints: VideoMixerLayerLayoutConstraints;
  sourceOptions: VideoSourceConstraint[];
  availableFeeds: Set<string>;
  maxLayers: number;
  /** Other places (encoders, other mixers) already using a given source — shown as a heads-up, never blocking. */
  sourceUsage?: Map<string, string[]>;
  onSelect: (index: number) => void;
  onChangeLayout: (index: number, layout: { x: number; y: number; zoom: number }) => void;
  onChangeSource: (index: number, source: string) => void;
  onToggleEnabled: (index: number) => void;
  onReorder: (index: number, dir: -1 | 1) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-body">
          Layers <span className="text-faint">(back → front)</span>
        </h3>
        <button
          onClick={onAdd}
          disabled={layers.length >= maxLayers}
          className="rounded border border-border-strong px-2 py-1 text-xs text-body hover:bg-panel-hover disabled:opacity-40"
          title={layers.length >= maxLayers ? `Max ${maxLayers} layers` : "Add a layer"}
        >
          + Add layer
        </button>
      </div>

      <ul className="space-y-2">
        {layers.map((layer, i) => {
          const selected = i === selectedIndex;
          const src = layer.input?.source ?? "";
          const feed = isFeedSource(src);
          const live = feed && availableFeeds.has(src);
          const disabled = !layer.enabled;
          const usedElsewhere = src ? sourceUsage?.get(src) : undefined;
          return (
            <li
              key={i}
              className={
                "rounded border p-2 " +
                (disabled
                  ? "border-border-default bg-panel-strong opacity-60"
                  : selected
                    ? "border-sky-500/60 bg-sky-500/5"
                    : "border-border-default bg-panel-strong")
              }
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layer.enabled}
                  onChange={() => onToggleEnabled(i)}
                  title={layer.enabled ? "Disable this layer" : "Enable this layer"}
                  className="shrink-0"
                />
                <button
                  onClick={() => onSelect(i)}
                  className="flex flex-1 items-center gap-2 text-left text-sm text-body"
                >
                  <span
                    className={
                      "h-2 w-2 rounded-full " +
                      (live ? "bg-emerald-400" : feed ? "bg-amber-400" : "bg-slate-500")
                    }
                    title={
                      live
                        ? "Live feed"
                        : feed
                          ? "Feed source, not currently available"
                          : "Filler / placeholder"
                    }
                  />
                  <span className="text-faint">L{i}</span>
                  <span>{sourceLabel(src)}</span>
                  {disabled && <span className="text-[10px] text-faint">(disabled)</span>}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onReorder(i, -1)}
                    disabled={i === 0}
                    className="rounded px-1 text-xs text-muted hover:bg-panel-hover disabled:opacity-30"
                    title="Send backward"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => onReorder(i, 1)}
                    disabled={i === layers.length - 1}
                    className="rounded px-1 text-xs text-muted hover:bg-panel-hover disabled:opacity-30"
                    title="Bring forward"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => onDelete(i)}
                    className="rounded px-1 text-xs text-danger hover:bg-red-500/10"
                    title="Remove layer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {usedElsewhere && usedElsewhere.length > 0 && (
                <p className="mt-1 pl-6 text-[11px] text-warning">
                  ⚠ Also used by {usedElsewhere.join(", ")}
                </p>
              )}

              {selected && (
                <div className="mt-2 space-y-2">
                  <label className="flex flex-col gap-0.5 text-xs text-muted">
                    Source
                    <select
                      value={src}
                      onChange={(e) => onChangeSource(i, e.target.value)}
                      className="w-full rounded border border-border-strong bg-page px-2 py-1 text-sm text-body"
                    >
                      <option value="">(no source)</option>
                      {sourceOptions.map((opt) => {
                        const usage = opt.value ? sourceUsage?.get(opt.value) : undefined;
                        return (
                          <option key={opt.value} value={opt.value}>
                            {opt.name}
                            {opt.value && !availableFeeds.has(opt.value) && isFeedSource(opt.value)
                              ? " (offline)"
                              : ""}
                            {usage && usage.length > 0 ? ` — used by ${usage.join(", ")}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberField
                      label="x"
                      value={layer.layout.x}
                      min={constraints.x.min}
                      max={constraints.x.max}
                      onChange={(v) =>
                        onChangeLayout(i, clampLayout({ ...layer.layout, x: v }, constraints))
                      }
                    />
                    <NumberField
                      label="y"
                      value={layer.layout.y}
                      min={constraints.y.min}
                      max={constraints.y.max}
                      onChange={(v) =>
                        onChangeLayout(i, clampLayout({ ...layer.layout, y: v }, constraints))
                      }
                    />
                    <NumberField
                      label="zoom"
                      value={layer.layout.zoom}
                      min={constraints.zoom.min}
                      max={constraints.zoom.max}
                      onChange={(v) =>
                        onChangeLayout(i, clampLayout({ ...layer.layout, zoom: v }, constraints))
                      }
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
