"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUnit } from "@/lib/units/context";

export interface PolledResourceState<T> {
  data: T | null;
  error: string | null;
  /** True only until the first response (success or error) arrives. */
  loading: boolean;
}

/**
 * Polls a unit-relative GET path on an interval, using ETag / If-None-Match
 * so unchanged status data comes back as a 304 (no body re-parsed, no state
 * update) instead of a full re-fetch every tick.
 *
 * `path` may include query params (e.g. `encoders/0?include=status`).
 * Pass `enabled: false` to pause polling without unmounting.
 *
 * Skips fetching while the tab/window is hidden (`document.visibilityState`)
 * — a backgrounded dashboard has no one watching it, so there's no reason to
 * keep hitting the unit and burning battery/data, especially on a phone.
 * Polling resumes immediately (not after a stale wait) the moment the page
 * becomes visible again.
 */
export function usePolledResource<T>(
  path: string,
  intervalMs = 5000,
  enabled = true,
): PolledResourceState<T> {
  const { base } = useCurrentUnit();
  const [state, setState] = useState<PolledResourceState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const etagRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    etagRef.current = null;

    async function poll() {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(poll, intervalMs);
        return;
      }
      try {
        const headers: HeadersInit = {};
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;

        const res = await fetch(`${base}/${path.replace(/^\/+/, "")}`, {
          headers,
          cache: "no-store",
        });
        if (cancelled) return;

        if (res.status === 304) {
          setState((s) => ({ ...s, loading: false, error: null }));
        } else if (res.ok) {
          const etag = res.headers.get("etag");
          if (etag) etagRef.current = etag;
          const data = (await res.json()) as T;
          setState({ data, error: null, loading: false });
        } else {
          let message = `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { message?: string };
            if (body.message) message = body.message;
          } catch {
            // non-JSON error body — keep the generic message
          }
          setState((s) => ({ ...s, loading: false, error: message }));
        }
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Network error",
        }));
      } finally {
        if (!cancelled) {
          timer = setTimeout(poll, intervalMs);
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        void poll();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intervalMs changes shouldn't restart with a stale etag
  }, [path, enabled, base]);

  return state;
}
