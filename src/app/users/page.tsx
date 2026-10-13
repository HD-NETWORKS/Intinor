"use client";

import { useCallback, useEffect, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { useSettingsEditor, type ArrayHelpers } from "@/hooks/useSettingsEditor";
import { useUnitMeta } from "@/hooks/useUnitMeta";
import { IntinorApiError } from "@/lib/intinor-client";
import type {
  UserCreateRequest,
  UserSettingsConstraints,
  UserSettingsRequest,
  UserSettingsResponse,
} from "@/lib/intinor/types";
import { RemoveButton } from "@/lib/settings/common-sections";
import type { FieldSection } from "@/lib/settings/fields";
import { optionsFromDescribed } from "@/lib/settings/options";
import { SettingsForm } from "@/components/settings/SettingsForm";

function describe(err: unknown, fallback: string): string {
  if (err instanceof IntinorApiError) return `${err.message} (HTTP ${err.status})`;
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * Stateless by design: the picked resource disappears from `available` the
 * instant it's added (it's now overridden), so there's no stale-selection
 * value to manage — the control always reads back to its placeholder.
 */
function AddPermissionOverride({
  available,
  onAdd,
}: {
  available: UserSettingsConstraints["permissions"];
  onAdd: (resource: string, role: string) => void;
}) {
  return (
    <select
      value=""
      onChange={(e) => {
        const picked = available.find((p) => p.resource === e.target.value);
        if (picked) onAdd(picked.resource, picked.role[0]?.value ?? "");
      }}
      className="rounded border border-border-strong bg-page px-2 py-1 text-xs text-body"
    >
      <option value="" disabled>
        Grant access to…
      </option>
      {available.map((p) => (
        <option key={p.resource} value={p.resource}>
          {p.description}
        </option>
      ))}
    </select>
  );
}

/**
 * Role + password at the top, then one section per *existing* permission
 * override with its own "Access level" dropdown + Remove button, plus a
 * header control to add an override for any not-yet-overridden resource.
 * Everything not overridden here just follows the role's own default — same
 * resolution the old read-only view already described, now writable.
 */
function userSections(s: UserSettingsResponse, helpers: ArrayHelpers): FieldSection[] {
  const c = s._constraints;

  const sections: FieldSection[] = [
    {
      title: "Account",
      fields: [
        { path: "role", label: "Role", kind: "select", options: optionsFromDescribed(c?.role) },
        {
          path: "password",
          label: "Password",
          kind: "password",
          help: "Leave blank to keep the current password.",
        },
      ],
    },
  ];

  const overridden = new Set((s.permissions ?? []).map((p) => p.resource));
  const available = (c?.permissions ?? []).filter((p) => !overridden.has(p.resource));

  sections.push({
    title: `Per-resource access overrides (${s.permissions?.length ?? 0})`,
    description: "Everything not listed below follows the role's default access.",
    headerExtra:
      available.length > 0 ? (
        <AddPermissionOverride
          available={available}
          onAdd={(resource, role) => helpers.addArrayItem("permissions", { resource, role })}
        />
      ) : undefined,
    fields: [],
  });

  (s.permissions ?? []).forEach((p, i) => {
    const resourceConstraint = c?.permissions?.find((pc) => pc.resource === p.resource);
    sections.push({
      title: resourceConstraint?.description ?? p.resource,
      headerExtra: <RemoveButton onClick={() => helpers.removeArrayItem("permissions", i)} />,
      fields: [
        {
          path: `permissions[${i}].role`,
          label: "Access level",
          kind: "select",
          options: optionsFromDescribed(resourceConstraint?.role),
        },
      ],
    });
  });

  return sections;
}

/** Deleting an account is immediate and irreversible (unlike a settings
 *  save, which goes through the usual draft → confirm diff cycle) — closer
 *  in kind to the Danger Zone's own actions, so it gets the same
 *  type-the-name-to-confirm guard rather than the lighter plain "Remove"
 *  button used for e.g. an access rule. */
function DeleteUserControl({ username, onDeleted }: { username: string; onDeleted: () => void }) {
  const client = useIntinorClient();
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await client.deleteUser(username);
      onDeleted();
    } catch (err) {
      setError(describe(err, "Failed to delete user"));
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-border-default pt-3">
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded border border-signal-red-500/40 px-3 py-1.5 text-sm text-danger hover:bg-signal-red-500/10"
        >
          Delete user…
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-danger">
            Type <code className="rounded bg-panel-hover px-1">{username}</code> to permanently
            delete this account.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={username}
              className="w-48 rounded border border-border-strong bg-page px-2 py-1.5 text-sm text-body"
            />
            <button
              type="button"
              onClick={run}
              disabled={typed !== username || busy}
              className="rounded bg-signal-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-signal-red-500 disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRevealed(false);
                setTyped("");
              }}
              disabled={busy}
              className="rounded border border-border-strong px-3 py-1.5 text-sm text-body hover:bg-panel-hover disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

function UserEditor({ username, onDeleted }: { username: string; onDeleted: () => void }) {
  const meta = useUnitMeta();
  const client = useIntinorClient();

  const load = useCallback(() => client.getUserSettings(username), [client, username]);
  const save = useCallback(
    (body: UserSettingsResponse) => client.putUserSettings(username, body as UserSettingsRequest),
    [client, username],
  );
  const editor = useSettingsEditor<UserSettingsResponse>({
    load,
    save,
    sectionsOf: userSections,
    mutableOf: (s) => s._constraints?.mutable,
  });

  return (
    <div className="space-y-0 rounded border border-border-default bg-panel">
      <div className="p-4 pb-0">
        <SettingsForm title={username} editor={editor} meta={meta} variant="card" />
      </div>
      <div className="px-4 pb-4">
        <DeleteUserControl username={username} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

function AddUserForm({
  roleOptions,
  onCreated,
  onCancel,
}: {
  roleOptions: UserSettingsConstraints["role"];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const client = useIntinorClient();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.value ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const body: UserCreateRequest = { settings: { username: username.trim(), role, password } };
      await client.createUser(body);
      onCreated();
    } catch (err) {
      setError(describe(err, "Failed to create user"));
      setBusy(false);
    }
  }

  const canCreate = username.trim().length > 0 && password.length > 0 && !busy;

  return (
    <section className="space-y-3 rounded border border-border-default bg-panel p-4">
      <h2 className="font-medium text-body">Add user</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            className="w-full rounded border border-border-strong bg-page px-2 py-1 text-sm text-body"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded border border-border-strong bg-page px-2 py-1 text-sm text-body"
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.description}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border-strong bg-page px-2 py-1 text-sm text-body"
          />
        </label>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={!canCreate}
          className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create user"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-border-strong px-3 py-1.5 text-sm text-body hover:bg-panel-hover disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

export default function UsersPage() {
  const client = useIntinorClient();
  const [usernames, setUsernames] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [roleOptions, setRoleOptions] = useState<UserSettingsConstraints["role"]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await client.getUsers();
        const names = list.users.map((u) => u.username);
        if (cancelled) return;
        setUsernames(names);
        setError(null);
        // Borrow the role option list from any one user's own _constraints
        // (every account sees the same global role list) so "Add user" has
        // something to offer without a dedicated endpoint for it.
        if (names[0]) {
          const s = await client.getUserSettings(names[0]);
          if (!cancelled && s._constraints) setRoleOptions(s._constraints.role);
        }
      } catch (err) {
        if (!cancelled) setError(describe(err, "Failed to load local users"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, reloadTick]);

  const refresh = useCallback(() => setReloadTick((t) => t + 1), []);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Local users</h1>
          <p className="text-sm text-faint">
            The unit&apos;s own accounts, roles, and per-resource permissions — separate from this
            dashboard&apos;s own login.
          </p>
        </div>
        {!adding && roleOptions.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="shrink-0 rounded border border-brand-500/60 bg-brand-500/10 px-3 py-1.5 text-sm text-accent hover:bg-brand-500/20"
          >
            + Add user
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-signal-red-500/40 bg-signal-red-500/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {adding && (
        <AddUserForm
          roleOptions={roleOptions}
          onCreated={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {!error && usernames === null && <p className="text-sm text-faint">Loading local users…</p>}
      {!error && usernames?.length === 0 && (
        <p className="text-sm text-faint">This unit has no local users.</p>
      )}

      {usernames?.map((username) => (
        <UserEditor key={username} username={username} onDeleted={refresh} />
      ))}
    </div>
  );
}
