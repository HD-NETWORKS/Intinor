"use client";

import { useCallback, useEffect, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { IntinorApiError } from "@/lib/intinor-client";
import type { UserSettingsResponse } from "@/lib/intinor/types";

function describe(err: unknown, fallback: string): string {
  if (err instanceof IntinorApiError) return `${err.message} (HTTP ${err.status})`;
  if (err instanceof Error) return err.message;
  return fallback;
}

/** Human label for a role value, from this user's own `_constraints.role` (or the raw value if unlisted). */
function roleLabel(user: UserSettingsResponse, value: string): string {
  return user._constraints?.role?.find((r) => r.value === value)?.description ?? value;
}

/** Human label for a permission's resource + role, from this user's own `_constraints.permissions`. */
function permissionLabels(
  user: UserSettingsResponse,
  resource: string,
  role: string | undefined,
): { resource: string; role: string } {
  const c = user._constraints?.permissions?.find((p) => p.resource === resource);
  return {
    resource: c?.description ?? resource,
    role: (role != null ? c?.role.find((r) => r.value === role)?.description : undefined) ?? role ?? "(default)",
  };
}

function UserCard({ user }: { user: UserSettingsResponse }) {
  return (
    <section className="space-y-3 rounded border border-border-default bg-panel p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-medium text-fg">{user.username}</h2>
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-accent">
          {roleLabel(user, user.role)}
        </span>
      </div>

      {user.permissions.length === 0 ? (
        <p className="text-xs text-faint">
          No per-resource permission overrides — access follows the {roleLabel(user, user.role).toLowerCase()} role
          default.
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-border-default">
          <table className="w-full text-left text-xs">
            <thead className="bg-panel-strong text-faint">
              <tr>
                <th className="px-3 py-1.5 font-medium">Resource</th>
                <th className="px-3 py-1.5 font-medium">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {user.permissions.map((p, i) => {
                const labels = permissionLabels(user, p.resource, p.role);
                return (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-body">{labels.resource}</td>
                    <td className="px-3 py-1.5 text-muted">{labels.role}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function UsersPage() {
  const client = useIntinorClient();
  const [users, setUsers] = useState<UserSettingsResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<UserSettingsResponse[]> => {
    const list = await client.getUsers();
    return Promise.all(list.users.map((u) => client.getUserSettings(u.username)));
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((loaded) => {
        if (cancelled) return;
        setUsers(loaded);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(describe(err, "Failed to load local users"));
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fg">Local users</h1>
        <p className="text-sm text-faint">
          The unit&apos;s own accounts and permissions — separate from this dashboard&apos;s own
          login. Read-only here by design: create, edit, delete, and password changes stay on the
          unit&apos;s own IDM console.
        </p>
      </div>

      {error && (
        <div className="rounded border border-signal-red-500/40 bg-signal-red-500/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {!error && users === null && <p className="text-sm text-faint">Loading local users…</p>}
      {!error && users?.length === 0 && (
        <p className="text-sm text-faint">This unit has no local users.</p>
      )}

      {users?.map((u) => (
        <UserCard key={u.username} user={u} />
      ))}
    </div>
  );
}
