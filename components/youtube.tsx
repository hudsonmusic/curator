"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";

export interface YTHandle {
  /** Current time if the video has been started, else null. */
  time: () => number | null;
  seek: (t: number) => void;
}

interface YTPlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  seekTo(t: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;
function loadApi() {
  apiReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiReady;
}

export function YouTube({
  query,
  handle,
  onPlay,
  onMissing,
}: {
  query: string;
  handle: MutableRefObject<YTHandle | null>;
  onPlay?: () => void;
  onMissing?: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onMissingRef = useRef(onMissing);
  onMissingRef.current = onMissing;

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
    (async () => {
      const { videoId } = (await fetch(`/api/youtube?q=${encodeURIComponent(query)}`).then((r) => r.json())) as {
        videoId: string | null;
      };
      if (cancelled) return;
      if (!videoId || !el.current) {
        setState("missing");
        onMissingRef.current?.();
        return;
      }
      await loadApi();
      if (cancelled || !el.current || !window.YT) return;
      player = new window.YT.Player(el.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) onPlayRef.current?.();
          },
        },
      });
      setState("ready");
      handle.current = {
        time: () => {
          try {
            const st = player!.getPlayerState();
            return st === 1 || st === 2 ? player!.getCurrentTime() : null;
          } catch {
            return null;
          }
        },
        seek: (t) => {
          player?.seekTo(t, true);
          player?.playVideo();
        },
      };
    })().catch(() => setState("missing"));
    return () => {
      cancelled = true;
      handle.current = null;
      try {
        player?.destroy();
      } catch {}
    };
  }, [query, handle]);

  if (state === "missing") return null;
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-panel">
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-line/40" />}
      <div ref={el} className="absolute inset-0" />
    </div>
  );
}
