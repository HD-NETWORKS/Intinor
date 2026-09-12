"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

/**
 * Click-to-watch preview — see README §Phase 24. Points hls.js (or Safari's
 * native HLS support) at the preview relay's public HLS URL for this stream,
 * and sends a heartbeat while open so the source server's agent knows to
 * keep its low-bitrate encode running. Closing this (unmount) stops the
 * heartbeats; the source stops encoding on its own a few seconds later once
 * the relay reports no recent heartbeat.
 */
const HEARTBEAT_MS = 5000;

function supportsNativeHls(): boolean {
  if (typeof document === "undefined") return false;
  return document.createElement("video").canPlayType("application/vnd.apple.mpegurl") !== "";
}

export function WatchModal({
  streamId,
  label,
  relayUrl,
  onClose,
}: {
  streamId: string;
  label: string;
  relayUrl: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(() =>
    supportsNativeHls() || Hls.isSupported() ? null : "This browser can't play HLS video.",
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || (!supportsNativeHls() && !Hls.isSupported())) return;

    const base = relayUrl.replace(/\/$/, "");
    const playlistUrl = `${base}/hls/${streamId}/index.m3u8`;

    if (supportsNativeHls()) {
      // Safari/iOS play HLS natively — no library needed.
      video.src = playlistUrl;
      void video.play().catch(() => {});
      return;
    }

    const hls = new Hls({ liveSyncDurationCount: 2 });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setError(`Playback error: ${data.details}`);
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => {}));
    hls.loadSource(playlistUrl);
    hls.attachMedia(video);

    return () => hls.destroy();
  }, [relayUrl, streamId]);

  useEffect(() => {
    const base = relayUrl.replace(/\/$/, "");
    const beat = () => {
      fetch(`${base}/viewers/${streamId}/heartbeat`, { method: "POST" }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [relayUrl, streamId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl space-y-3 rounded border border-border-strong bg-surface-solid p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-fg">{label}</h2>
            <p className="font-mono text-[11px] text-faint">{streamId}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted hover:bg-panel-hover hover:text-body"
          >
            ✕
          </button>
        </div>

        <div className="overflow-hidden rounded bg-slate-950">
          <video ref={videoRef} controls autoPlay muted playsInline className="aspect-video w-full" />
        </div>

        <p className="text-[11px] text-faint">
          Low-bitrate preview (~600kbps) relayed from the source server — not the broadcast feed
          itself. May take a few seconds to start while the source spins up its encode.
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
