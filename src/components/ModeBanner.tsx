"use client";

import { useEffect, useState } from "react";
import { useCurrentUnit } from "@/lib/units/context";

interface Meta {
  mock: boolean;
  writesAllowed: boolean;
  destructiveActionsAllowed: boolean;
  configured: boolean;
  authDisabled: boolean;
  authConfigured: boolean;
}

const AUTH_WARNING_DISMISSED_KEY = "intinor-auth-warning-dismissed";

/**
 * Always-visible strip showing which mode the dashboard is in, so mock data
 * can never be mistaken for the live unit — and live-write mode never goes
 * unnoticed. Unit id/label reflect whichever unit is currently selected (see
 * UnitProvider) rather than always the default, so switching units is
 * reflected here too.
 *
 * Only the local-dev "auth disabled" nag is dismissible (per browser tab
 * session, via sessionStorage — it comes back on a fresh session). The
 * mock/misconfigured/live-write banners are deliberately not dismissible:
 * they're safety signals about the unit itself, not a one-time nag.
 */
export function ModeBanner() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [authWarningDismissed, setAuthWarningDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(AUTH_WARNING_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const { unitId, units } = useCurrentUnit();

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  if (!meta) return null;

  const current = units.find((u) => u.id === unitId);
  const unitLabel = current?.label ? `${current.label} (${current.id})` : (unitId ?? "—");

  const authWarning = meta.authDisabled && !authWarningDismissed ? (
    <div className="flex items-start gap-3 border-b border-signal-red-500/40 bg-signal-red-500/15 px-4 py-1.5 text-sm text-danger sm:px-6">
      <span className="flex-1">
        <strong>DASHBOARD_AUTH_DISABLED=1</strong> — no login gate. Local dev only; never set this
        on a deployment reachable from the internet.
      </span>
      <button
        type="button"
        onClick={() => {
          setAuthWarningDismissed(true);
          try {
            sessionStorage.setItem(AUTH_WARNING_DISMISSED_KEY, "1");
          } catch {
            // ignore — dismissal just won't persist
          }
        }}
        aria-label="Dismiss this warning"
        className="shrink-0 rounded px-1 text-danger/70 hover:text-danger"
      >
        ✕
      </button>
    </div>
  ) : null;

  if (meta.mock) {
    return (
      <>
        {authWarning}
        <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-1.5 text-sm text-warning sm:px-6">
          <strong>Mock mode</strong> — showing fake data ({unitLabel}). No requests reach a real
          unit.
        </div>
      </>
    );
  }

  if (!meta.configured) {
    return (
      <>
        {authWarning}
        <div className="border-b border-signal-red-500/40 bg-signal-red-500/15 px-4 py-1.5 text-sm text-danger sm:px-6">
          <strong>Not configured</strong> — set INTINOR_* variables in .env.local
          or enable MOCK=1.
        </div>
      </>
    );
  }

  return (
    <>
      {authWarning}
      <div
        className={
          "px-4 py-1.5 text-sm sm:px-6 " +
          (meta.writesAllowed
            ? "border-b border-signal-red-500/40 bg-signal-red-500/15 text-danger"
            : "border-b border-brand-500/30 bg-brand-500/10 text-accent")
        }
      >
        {meta.writesAllowed ? (
          <>
            <strong>Live unit {unitLabel} — WRITES ENABLED.</strong> Changes affect the real
            broadcast chain.
          </>
        ) : (
          <>
            <strong>Live unit {unitLabel}</strong> — read-only mode. All writes are blocked by the
            proxy.
          </>
        )}
      </div>
    </>
  );
}
