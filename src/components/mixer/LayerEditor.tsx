"use client";

import type {
  VideoMixerLayerLayoutConstraints,
  VideoMixerLayerSettings,
  VideoSourceConstraint,
} from "@/lib/intinor/types";
import { clampLayout, isFeedSource } from "@/lib/mixer-layout";
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
    <label className="flex flex-col gap-0.5 text-xs text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={0.05}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
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
  onSelect,
  onChangeLayout,
  onChangeSource,
  onReorder,
  onDelete,
  onAdd,
}: {
  layers: VideoMixerLayerSettings[];
  selectedIndex: number | null;
  constraints: VideoMixerLayerLayoutConstraints;
  sourceOptions: VideoSourceConstraint[];
  availableFeeds: Set<string>;
  maxLayers: number;
  onSelect: (index: number) => void;
  onChangeLayout: (index: number, layout: { x: number; y: number; zoom: number }) => void;
  onChangeSource: (index: number, source: string) => void;
  onReorder: (index: number, dir: -1 | 1) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">
          Layers <span className="text-slate-500">(back → front)</span>
        </h3>
        <button
          onClick={onAdd}
          disabled={layers.length >= maxLayers}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
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
          return (
            <li
              key={i}
              className={
                "rounded border p-2 " +
                (selected
                  ? "border-sky-500/60 bg-sky-500/5"
                  : "border-slate-800 bg-slate-950/50")
              }
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelect(i)}
                  className="flex flex-1 items-center gap-2 text-left text-sm text-slate-200"
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
                  <span className="text-slate-500">L{i}</span>
                  <span>{sourceLabel(src)}</span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onReorder(i, -1)}
                    disabled={i === 0}
                    className="rounded px-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                    title="Send backward"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => onReorder(i, 1)}
                    disabled={i === layers.length - 1}
                    className="rounded px-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                    title="Bring forward"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => onDelete(i)}
                    className="rounded px-1 text-xs text-red-400 hover:bg-red-500/10"
                    title="Remove layer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {selected && (
                <div className="mt-2 space-y-2">
                  <label className="flex flex-col gap-0.5 text-xs text-slate-400">
                    Source
                    <select
                      value={src}
                      onChange={(e) => onChangeSource(i, e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                    >
                      <option value="">(no source)</option>
                      {sourceOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.name}
                          {opt.value && !availableFeeds.has(opt.value) && isFeedSource(opt.value)
                            ? " (offline)"
                            : ""}
                        </option>
                      ))}
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
