export function PhasePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
      <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
        <p className="text-slate-400">{description}</p>
        <p className="mt-2 text-sm text-slate-500">
          Coming in a later phase — the typed client and proxy already support
          this resource group.
        </p>
      </div>
    </div>
  );
}
