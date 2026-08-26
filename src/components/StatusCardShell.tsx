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
  description,
  active,
  loading,
  error,
  messages,
  stats,
  children,
  onClick,
}: {
  title: string;
  description?: string;
  active?: boolean;
  loading?: boolean;
  error?: string | null;
  messages?: StatusMessage[];
  stats: Stat[];
  children?: React.ReactNode;
  /** When set, the whole card becomes a click target (e.g. to open that item's settings). */
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      title={onClick ? "Click to open settings" : undefined}
      className={
        "space-y-3 rounded border border-border-default bg-panel p-4" +
        (onClick ? " cursor-pointer hover:border-brand-600/60" : "")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={
              "h-2.5 w-2.5 shrink-0 rounded-full " +
              (active == null ? "bg-slate-700" : active ? "bg-emerald-400" : "bg-slate-600")
            }
            title={active == null ? "Unknown" : active ? "Active" : "Inactive"}
          />
          <h2 className="font-medium text-body">{title}</h2>
        </div>
        {loading && <span className="text-xs text-faint">Loading…</span>}
      </div>

      {description && <p className="text-sm text-muted">{description}</p>}

      {error ? (
        <div className="rounded border border-signal-red-500/40 bg-signal-red-500/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-xs font-mono uppercase tracking-wide text-faint">{s.label}</dt>
                <dd className="truncate text-body" title={s.value}>
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
                      ? "bg-signal-red-500/10 text-danger"
                      : m.severity === "warning"
                        ? "bg-amber-500/10 text-warning"
                        : "bg-panel-hover text-muted")
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
