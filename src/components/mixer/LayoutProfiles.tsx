"use client";

import { useState } from "react";
import type { MixerProfile } from "@/lib/mixer-profiles";

export function LayoutProfiles({
  profiles,
  onSave,
  onApply,
  onDelete,
}: {
  profiles: MixerProfile[];
  onSave: (name: string) => void;
  onApply: (profile: MixerProfile) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-300">Layout profiles</h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            onSave(name);
            setName("");
          }
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunday service quad"
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          Save current
        </button>
      </form>

      {profiles.length === 0 ? (
        <p className="text-xs text-slate-500">
          No saved profiles yet. Build a layout and save it to switch back with one
          click. Profiles are stored in this browser.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-sm"
            >
              <span className="flex-1 truncate text-slate-200" title={p.name}>
                {p.name}
              </span>
              <span className="text-xs text-slate-500">{p.layers.length} layers</span>
              <button
                onClick={() => onApply(p)}
                className="rounded border border-slate-700 px-2 py-0.5 text-xs text-sky-300 hover:bg-slate-800"
              >
                Load
              </button>
              <button
                onClick={() => onDelete(p.id)}
                className="rounded px-1 text-xs text-red-400 hover:bg-red-500/10"
                title="Delete profile"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
