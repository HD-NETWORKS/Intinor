"use client";

import { useState } from "react";

/**
 * Dense list shell for a resource type with many pipes — search/filter over
 * the list metadata, then delegate each row's own live status/thumbnail
 * fetch to `renderRow` (same per-row polling as the card grid, just laid out
 * as a compact row instead of a big card).
 */
export function PipeTable({
  title,
  items,
  renderRow,
  emptyMessage,
}: {
  title: string;
  items: Array<{ index: number; description?: string }>;
  renderRow: (item: { index: number; description?: string }) => React.ReactNode;
  emptyMessage: string;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? items.filter(
        (it) =>
          (it.description ?? "").toLowerCase().includes(needle) ||
          String(it.index).includes(needle),
      )
    : items;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-3">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter…"
          className="w-48 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-300 placeholder:text-slate-600"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">
          {items.length === 0 ? emptyMessage : "No matches."}
        </p>
      ) : (
        <div className="divide-y divide-slate-800">
          {filtered.map((it) => (
            <div key={it.index}>{renderRow(it)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
