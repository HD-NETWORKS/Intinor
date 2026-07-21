"use client";

import { useEffect, useRef, useState } from "react";
import { UNIT_PROXY_BASE } from "@/lib/intinor-client";

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
 */
export function usePolledResource<T>(
  path: string,
  intervalMs = 5000,
  enabled = true,
): PolledResourceState<T> {
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
      try {
        const headers: HeadersInit = {};
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;

        const res = await fetch(`${UNIT_PROXY_BASE}/${path.replace(/^\/+/, "")}`, {
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

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intervalMs changes shouldn't restart with a stale etag
  }, [path, enabled]);

  return state;
}
