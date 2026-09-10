"use client";

import { useEffect, useState } from "react";
import { useThumbnailTick, withThumbnailTick } from "@/hooks/useThumbnailTick";

interface ZixiStream {
  streamId: string;
  label: string;
  lastSeenAt: string;
  snapshotUrl: string | null;
}

interface ZixiResponse {
  configured: boolean;
  streams: ZixiStream[];
  message?: string;
  error?: string;
}

const POLL_MS = 5000;
/** No push in this long flags a tile stale — a couple of missed cycles, not a hair trigger. */
const STALE_AFTER_MS = 30_000;

function useZixiStreams(): { data: ZixiResponse | null; loading: boolean } {
  const [data, setData] = useState<ZixiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(poll, POLL_MS);
        return;
      }
      try {
        const res = await fetch("/api/zixi-snapshot", { cache: "no-store" });
        const body = (await res.json()) as ZixiResponse;
        if (!cancelled) {
          setData(body);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
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
  }, []);

  return { data, loading };
}

function msSince(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

function StreamTile({ stream, tick }: { stream: ZixiStream; tick: number }) {
  const [age, setAge] = useState(() => msSince(stream.lastSeenAt));
  useEffect(() => {
    const id = setInterval(() => setAge(msSince(stream.lastSeenAt)), 1000);
    return () => clearInterval(id);
  }, [stream.lastSeenAt]);

  const stale = age > STALE_AFTER_MS;

  return (
    <div
      className={
        "space-y-1.5 rounded border p-2 " +
        (stale ? "border-signal-red-500/50 bg-signal-red-500/5" : "border-border-default bg-panel")
      }
    >
      <div className="flex h-32 items-center justify-center overflow-hidden rounded bg-slate-950">
        {stream.snapshotUrl ? (
          // Public Supabase Storage object — plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withThumbnailTick(stream.snapshotUrl, tick)}
            alt={stream.label}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-wide text-slate-600">
            No snapshot yet
          </span>
        )}
      </div>
      <div className="truncate text-sm text-body">{stream.label}</div>
      <div className="flex items-center justify-between text-[11px] text-faint">
        <span className="font-mono">{stream.streamId}</span>
        <span className={stale ? "text-danger" : undefined}>
          {stale ? "No recent update" : `Updated ${Math.round(age / 1000)}s ago`}
        </span>
      </div>
    </div>
  );
}

export default function ZixiPage() {
  const { data, loading } = useZixiStreams();
  const tick = useThumbnailTick(POLL_MS);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fg">Zixi feed monitor</h1>
        <p className="text-sm text-faint">
          Live snapshots from each server pushing to Zixi, for at-a-glance confirmation the
          feed going out actually has picture — independent of the satellite link or the
          teleport&apos;s receiver, which this dashboard has no visibility into.
        </p>
      </div>

      {!loading && data && !data.configured ? (
        <div className="rounded border border-dashed border-border-strong bg-panel p-5 text-sm text-muted">
          <p className="text-body">Zixi snapshot storage isn&apos;t configured yet.</p>
          <p className="mt-1 text-faint">{data.message}</p>
        </div>
      ) : !loading && data?.error ? (
        <div className="rounded border border-signal-red-500/40 bg-signal-red-500/10 px-4 py-3 text-sm text-danger">
          {data.error}
        </div>
      ) : !loading && data && data.streams.length === 0 ? (
        <div className="rounded border border-dashed border-border-strong bg-panel p-5 text-sm text-muted">
          <p className="text-body">No streams have reported in yet.</p>
          <p className="mt-1 text-faint">
            A stream appears here automatically the first time its install-script agent pushes
            a snapshot — nothing to configure on this side.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {(data?.streams ?? []).map((s) => (
            <StreamTile key={s.streamId} stream={s} tick={tick} />
          ))}
        </div>
      )}
    </div>
  );
}
