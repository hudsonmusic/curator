"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Track } from "./types";

export interface ScStatus {
  configured: boolean;
  connected: boolean;
  user?: { username?: string; avatar?: string };
}

let status: ScStatus | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function refreshScStatus() {
  loading = fetch("/api/soundcloud/status")
    .then((r) => r.json() as Promise<ScStatus>)
    .catch(() => ({ configured: false, connected: false }))
    .then((s) => {
      status = s;
      listeners.forEach((l) => l());
    });
  return loading;
}

export function useScStatus(): ScStatus | null {
  const s = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => status,
    () => null,
  );
  useEffect(() => {
    if (!loading) void refreshScStatus();
  }, []);
  return s;
}

export const scConnected = () => !!status?.connected;

const matches = new Map<string, Promise<Track | null>>();

/** The full-length SoundCloud version of a song, if one can be found. Cached per track. */
export function fullVersion(t: Track): Promise<Track | null> {
  if (t.source === "soundcloud" || !scConnected()) return Promise.resolve(null);
  let p = matches.get(t.id);
  if (!p) {
    const qs = new URLSearchParams({ artist: t.artist, title: t.title, dur: String(t.durationSec ?? 0) });
    p = fetch(`/api/soundcloud/match?${qs}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ track: Track | null }>) : { track: null }))
      .then((d) => d.track)
      .catch(() => null);
    matches.set(t.id, p);
  }
  return p;
}
