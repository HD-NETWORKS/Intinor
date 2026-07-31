"use client";

import { useTheme, type ThemePreference } from "@/lib/theme/context";

const OPTIONS: { value: ThemePreference; label: string; title: string }[] = [
  { value: "system", label: "Auto", title: "Match system setting" },
  { value: "light", label: "Light", title: "Always light" },
  { value: "dark", label: "Dark", title: "Always dark" },
];

/** Three-way theme control — defaults to "system" until the user picks otherwise. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded border border-border-default p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          onClick={() => setPreference(opt.value)}
          className={
            "rounded px-2 py-1 text-xs transition-colors " +
            (preference === opt.value
              ? "bg-sky-500/15 text-accent"
              : "text-muted hover:bg-panel-hover hover:text-body")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
