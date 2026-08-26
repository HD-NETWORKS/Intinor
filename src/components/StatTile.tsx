export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-default bg-panel p-4">
      <div className="text-xs font-mono uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-fg">{value}</div>
    </div>
  );
}
