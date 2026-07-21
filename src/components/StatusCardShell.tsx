export interface Stat {
  label: string;
  value?: string;
}

interface StatusMessage {
  severity: string;
  message: string;
}

export function StatusCardShell({
  title,
  index,
  description,
  active,
  loading,
  error,
  messages,
  stats,
  children,
}: {
  title: string;
  index: number;
  description?: string;
  active?: boolean;
  loading?: boolean;
  error?: string | null;
  messages?: StatusMessage[];
  stats: Stat[];
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={
              "h-2.5 w-2.5 shrink-0 rounded-full " +
              (active == null ? "bg-slate-700" : active ? "bg-emerald-400" : "bg-slate-600")
            }
            title={active == null ? "Unknown" : active ? "Active" : "Inactive"}
          />
          <h2 className="font-medium text-slate-200">
            {title} <span className="text-slate-500">#{index}</span>
          </h2>
        </div>
        {loading && <span className="text-xs text-slate-500">Loading…</span>}
      </div>

      {description && <p className="text-sm text-slate-400">{description}</p>}

      {error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{s.label}</dt>
                <dd className="truncate text-slate-200" title={s.value}>
                  {s.value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>

          {children}

          {messages && messages.length > 0 && (
            <ul className="space-y-1">
              {messages.map((m, i) => (
                <li
                  key={i}
                  className={
                    "rounded px-2 py-1 text-xs " +
                    (m.severity === "error"
                      ? "bg-red-500/10 text-red-300"
                      : m.severity === "warning"
                        ? "bg-amber-500/10 text-amber-300"
                        : "bg-slate-800/60 text-slate-400")
                  }
                >
                  {m.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
