"use client";

import type { Track } from "@/lib/types";

export interface YTPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(t: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(r: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

/** Loads YouTube's official IFrame Player API once. */
export function loadYouTubeApi() {
  apiReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiReady;
}

const ids = new Map<string, Promise<string | null>>();

/** The YouTube video for a song (cached per track). */
export function findVideo(t: Track): Promise<string | null> {
  let p = ids.get(t.id);
  if (!p) {
    const title = t.title.replace(/\s*[([].*?[)\]]/g, "").trim();
    p = fetch(`/api/youtube?q=${encodeURIComponent(`${t.artist} - ${title}`)}`)
      .then((r) => r.json() as Promise<{ videoId: string | null }>)
      .then((d) => d.videoId)
      .catch(() => null);
    ids.set(t.id, p);
  }
  return p;
}
