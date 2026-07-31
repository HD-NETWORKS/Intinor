"use client";

import { useId, useMemo, useRef, useState } from "react";

/**
 * Time-series line chart, inline SVG, no charting dependency.
 *
 * Follows the house data-viz rules:
 *  - one y-axis only (never dual-axis — separate measures get separate charts)
 *  - categorical hues assigned in fixed slot order, never by rank, so a series
 *    keeps its colour regardless of how many are shown
 *  - 2px lines, recessive grid, no marker on every point
 *  - legend whenever there are ≥2 series (identity is never colour-alone),
 *    plus a table view for screen readers and colour-vision differences
 *  - crosshair + tooltip by default
 *
 * Palette slots are the validated dark-mode steps, checked against this
 * dashboard's own surface (#0b0f17): worst-pair CVD ΔE 26.8, normal-vision
 * 31.8, both ≥3:1 contrast.
 */

export const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500"] as const;

export interface Series {
  name: string;
  /** Slot index into SERIES_COLORS — tied to the entity, not its position. */
  colorSlot: number;
  points: Array<{ ts: number; value: number | null }>;
}

interface Props {
  title: string;
  series: Series[];
  /** Formats a y value for ticks and tooltip. */
  format: (v: number) => string;
  /** Force the axis to start at zero (right for rates and percentages). */
  zeroBased?: boolean;
  /** Clamp the top of the scale, e.g. 100 for percentages. */
  maxHint?: number;
  height?: number;
  emptyMessage?: string;
}

const PAD = { top: 8, right: 12, bottom: 22, left: 52 };

export function TimeSeriesChart({
  title,
  series,
  format,
  zeroBased = true,
  maxHint,
  height = 180,
  emptyMessage = "No data yet.",
}: Props) {
  const gradId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const W = 720; // viewBox width; the SVG scales to its container
  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const stats = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const values = all
      .map((p) => p.value)
      .filter((v): v is number => typeof v === "number");
    const times = all.map((p) => p.ts);
    if (!values.length || !times.length) return null;

    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    let yMin = zeroBased ? 0 : Math.min(...values);
    let yMax = Math.max(...values);
    if (maxHint != null) yMax = Math.max(yMax, 0) === 0 ? maxHint : Math.min(yMax * 1.15, maxHint);
    else yMax = yMax * 1.15;
    if (yMax === yMin) yMax = yMin + 1;
    if (!zeroBased) yMin = yMin - (yMax - yMin) * 0.1;

    return { tMin, tMax: tMax === tMin ? tMin + 1 : tMax, yMin, yMax };
  }, [series, zeroBased, maxHint]);

  if (!stats) {
    return (
      <figure className="rounded-lg border border-border-default bg-panel p-4">
        <figcaption className="mb-2 text-sm font-medium text-body">{title}</figcaption>
        <div className="flex h-32 items-center justify-center text-sm text-faint">
          {emptyMessage}
        </div>
      </figure>
    );
  }

  const x = (ts: number) => PAD.left + ((ts - stats.tMin) / (stats.tMax - stats.tMin)) * plotW;
  const y = (v: number) =>
    PAD.top + plotH - ((v - stats.yMin) / (stats.yMax - stats.yMin)) * plotH;

  // Break the path at gaps so a polling outage reads as a gap, not as a
  // straight line implying data we never collected.
  const pathFor = (s: Series) => {
    let d = "";
    let pen = false;
    for (const p of s.points) {
      if (p.value == null) {
        pen = false;
        continue;
      }
      const cmd = pen ? "L" : "M";
      d += `${cmd}${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => stats.yMin + (stats.yMax - stats.yMin) * f);
  const xTicks = [0, 0.5, 1].map((f) => stats.tMin + (stats.tMax - stats.tMin) * f);

  // Nearest sample to the cursor, for the crosshair readout.
  const allTs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.ts)))).sort(
    (a, b) => a - b,
  );
  const hoverTs =
    hoverX == null || !allTs.length
      ? null
      : allTs.reduce((best, ts) => (Math.abs(x(ts) - hoverX) < Math.abs(x(best) - hoverX) ? ts : best), allTs[0]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverX(((e.clientX - rect.left) / rect.width) * W);
  }

  return (
    <figure className="rounded-lg border border-border-default bg-panel p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-sm font-medium text-body">{title}</figcaption>
        <div className="flex items-center gap-3">
          {series.length >= 2 && (
            <ul className="flex flex-wrap gap-3">
              {series.map((s) => (
                <li key={s.name} className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: SERIES_COLORS[s.colorSlot % SERIES_COLORS.length] }}
                  />
                  {s.name}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setShowTable((v) => !v)}
            className="text-xs text-faint underline decoration-dotted hover:text-body"
            aria-expanded={showTable}
          >
            {showTable ? "Hide table" : "Table"}
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        style={{ height }}
        role="img"
        aria-label={`${title}. ${series.map((s) => s.name).join(", ")}. Use the table view for exact values.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverX(null)}
      >
        <defs>
          <clipPath id={gradId}>
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* recessive grid + y ticks */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 3}
              textAnchor="end"
              fill="var(--chart-axis-text)"
              fontSize={10}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {format(v)}
            </text>
          </g>
        ))}

        {/* x ticks */}
        {xTicks.map((ts, i) => (
          <text
            key={i}
            x={x(ts)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fill="var(--chart-axis-text)"
            fontSize={10}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </text>
        ))}

        {/* series */}
        <g clipPath={`url(#${gradId})`}>
          {series.map((s) => (
            <path
              key={s.name}
              d={pathFor(s)}
              fill="none"
              stroke={SERIES_COLORS[s.colorSlot % SERIES_COLORS.length]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* crosshair */}
        {hoverTs != null && (
          <g>
            <line
              x1={x(hoverTs)}
              x2={x(hoverTs)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--chart-axis-text)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {series.map((s) => {
              const pt = s.points.find((p) => p.ts === hoverTs);
              if (!pt || pt.value == null) return null;
              return (
                <circle
                  key={s.name}
                  cx={x(hoverTs)}
                  cy={y(pt.value)}
                  r={4}
                  fill={SERIES_COLORS[s.colorSlot % SERIES_COLORS.length]}
                  stroke="var(--page)"
                  strokeWidth={2}
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* tooltip readout — plain text below the plot, so it never covers data */}
      <div className="mt-1 min-h-[1.25rem] text-xs text-muted">
        {hoverTs != null ? (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {new Date(hoverTs).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {series.map((s) => {
              const pt = s.points.find((p) => p.ts === hoverTs);
              return (
                <span key={s.name} className="ml-3">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: SERIES_COLORS[s.colorSlot % SERIES_COLORS.length] }}
                  />
                  {s.name}: {pt?.value != null ? format(pt.value) : "—"}
                </span>
              );
            })}
          </span>
        ) : (
          <span className="text-subtle">Hover the chart for values.</span>
        )}
      </div>

      {showTable && (
        <div className="mt-2 max-h-56 overflow-auto rounded border border-border-default">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel text-muted">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Time</th>
                {series.map((s) => (
                  <th key={s.name} className="px-2 py-1 text-right font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-body">
              {allTs.map((ts) => (
                <tr key={ts} className="border-t border-border-default">
                  <td className="px-2 py-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {new Date(ts).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  {series.map((s) => {
                    const pt = s.points.find((p) => p.ts === ts);
                    return (
                      <td
                        key={s.name}
                        className="px-2 py-0.5 text-right"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {pt?.value != null ? format(pt.value) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
