"use client";

import { useRef } from "react";
import type {
  VideoMixerLayerLayoutConstraints,
  VideoMixerLayerSettings,
} from "@/lib/intinor/types";
import { clampLayout, isFeedSource, round3 } from "@/lib/mixer-layout";
import { sourceLabel } from "./sourceLabel";

type DragState =
  | { kind: "move"; index: number; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; index: number; origLeft: number; origTop: number };

/**
 * 16:9 canvas of draggable / resizable layer boxes. Each box maps directly to
 * a layer's { x, y, zoom }: left = x·W, top = y·H, width = height = zoom·W
 * (a 16:9 box inside a 16:9 frame). Drag the body to move (x/y), drag the
 * bottom-right handle to resize (zoom). All values are clamped to the unit's
 * layout constraints.
 */
export function MixerCanvas({
  layers,
  selectedIndex,
  constraints,
  availableFeeds,
  onSelect,
  onChangeLayout,
}: {
  layers: VideoMixerLayerSettings[];
  selectedIndex: number | null;
  constraints: VideoMixerLayerLayoutConstraints;
  availableFeeds: Set<string>;
  onSelect: (index: number) => void;
  onChangeLayout: (index: number, layout: { x: number; y: number; zoom: number }) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  function canvasRect() {
    return canvasRef.current?.getBoundingClientRect() ?? null;
  }

  function handleMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const rect = canvasRect();
    if (!drag || !rect) return;

    if (drag.kind === "move") {
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      const next = clampLayout(
        { x: drag.origX + dx, y: drag.origY + dy, zoom: layers[drag.index].layout.zoom },
        constraints,
      );
      onChangeLayout(drag.index, next);
    } else {
      // Resize: the box's right edge tracks the pointer; zoom drives both dims.
      const pointerFracX = (e.clientX - rect.left) / rect.width;
      const zoom = pointerFracX - drag.origLeft;
      const next = clampLayout(
        { x: drag.origLeft, y: drag.origTop, zoom },
        constraints,
      );
      onChangeLayout(drag.index, next);
    }
  }

  function endDrag(e: React.PointerEvent) {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  return (
    <div
      ref={canvasRef}
      className="relative aspect-video w-full overflow-hidden rounded border border-slate-700 bg-[repeating-conic-gradient(#0e1626_0%_25%,#0b111d_0%_50%)] bg-[length:32px_32px] select-none"
      onPointerMove={handleMove}
      onPointerUp={endDrag}
    >
      {layers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
          No layers — add one or pick a preset.
        </div>
      )}

      {layers.map((layer, i) => {
        const { x, y, zoom } = layer.layout;
        const selected = i === selectedIndex;
        const feed = isFeedSource(layer.input?.source);
        const live = feed && availableFeeds.has(layer.input?.source ?? "");
        return (
          <div
            key={i}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).dataset.handle) return; // resize handled below
              onSelect(i);
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              dragRef.current = {
                kind: "move",
                index: i,
                startX: e.clientX,
                startY: e.clientY,
                origX: x,
                origY: y,
              };
            }}
            className={
              "absolute flex cursor-move items-center justify-center overflow-hidden text-xs font-medium " +
              (selected
                ? "z-10 ring-2 ring-sky-400"
                : "ring-1 ring-slate-600 hover:ring-slate-400")
            }
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${zoom * 100}%`,
              height: `${zoom * 100}%`,
              background: live
                ? "rgba(29,78,216,0.55)"
                : feed
                  ? "rgba(120,53,15,0.5)"
                  : "rgba(71,85,105,0.5)",
            }}
            title={layer.input?.source ?? "(no source)"}
          >
            <div className="pointer-events-none px-1 text-center text-slate-100">
              <div>{sourceLabel(layer.input?.source)}</div>
              <div className="text-[10px] text-slate-300">
                L{i} · {round3(zoom)}×
              </div>
            </div>
            {selected && (
              <span
                data-handle="resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  dragRef.current = {
                    kind: "resize",
                    index: i,
                    origLeft: x,
                    origTop: y,
                  };
                }}
                className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize bg-sky-400"
                title="Drag to resize"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
