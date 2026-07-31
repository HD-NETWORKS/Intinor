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
    <div className="rounded-lg border border-border-default bg-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border-default p-3">
        <h3 className="text-sm font-medium text-body">{title}</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter…"
          className="w-48 rounded border border-border-strong bg-panel px-2 py-1 text-sm text-body placeholder:text-subtle"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="p-4 text-sm text-faint">
          {items.length === 0 ? emptyMessage : "No matches."}
        </p>
      ) : (
        <div className="divide-y divide-border-default">
          {filtered.map((it) => (
            <div key={it.index}>{renderRow(it)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
