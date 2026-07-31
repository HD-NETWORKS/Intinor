"use client";

/**
 * Selector shown when the unit exposes more than one pipe of a kind. With this
 * unit's single encoder / input / mixer it renders nothing — but the pages
 * iterate whatever the API returns, so a second unit or a licence upgrade
 * makes the picker appear with no code change.
 */
export function PipePicker({
  items,
  selected,
  onSelect,
  label,
}: {
  items: Array<{ index: number; description: string }>;
  selected: number;
  onSelect: (index: number) => void;
  label: string;
}) {
  if (items.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-faint">{label}</span>
      {items.map((item) => (
        <button
          key={item.index}
          onClick={() => onSelect(item.index)}
          className={
            "rounded border px-3 py-1 text-sm " +
            (item.index === selected
              ? "border-sky-500/60 bg-sky-500/10 text-accent"
              : "border-border-strong text-body hover:bg-panel-hover")
          }
        >
          {item.description}
        </button>
      ))}
    </div>
  );
}
