"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Track } from "./types";

/**
 * Curator Helper: a small Mac app that saves songs as tagged audio files for Ableton.
 * It listens on this Mac only (127.0.0.1); the site talks to it straight from the browser.
 */
export const HELPER_URL = "http://127.0.0.1:47533";
/** The newest helper version; Settings offers an update when yours is older. */
export const HELPER_LATEST = "1.0.0";
export const HELPER_DOWNLOAD = "https://github.com/hudsonmusic/curator/releases/latest";

export type HelperFormat = "aiff" | "wav" | "mp3";

export interface HelperStatus {
  app: "curator-helper";
  version: string;
  paired: boolean;
  folder?: string;
  format?: HelperFormat;
  openAtLogin?: boolean;
  ytDlp?: string;
}

export interface HelperJob {
  id: string;
  state: "queued" | "downloading" | "converting" | "done" | "error";
  progress: number;
  file?: string;
  error?: string;
}

// ---- shared state (one poll for the whole page)
let status: HelperStatus | null | undefined = undefined; // undefined = not checked yet
const jobs = new Map<string, HelperJob>(); // by track id
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function call<T>(path: string, body?: unknown, timeout = 4000): Promise<T> {
  const res = await fetch(`${HELPER_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Helper error ${res.status}`);
  return data;
}

export async function refreshHelper(): Promise<HelperStatus | null> {
  try {
    const s = await call<HelperStatus>("/status", undefined, 1500);
    status = s.app === "curator-helper" ? s : null;
  } catch {
    status = null;
  }
  emit();
  return status;
}

/** Status of the helper on this Mac (null when it isn't running). Polls while `enabled`. */
export function useHelper(enabled: boolean) {
  const s = useSyncExternalStore(subscribe, () => status, () => undefined);
  useEffect(() => {
    if (!enabled) return;
    startPolling();
    return stopPolling;
  }, [enabled]);
  return s;
}

// One poll however many buttons are on the page.
let pollers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const onFocus = () => void refreshHelper();
function startPolling() {
  if (pollers++ > 0) return;
  void refreshHelper();
  timer = setInterval(() => void refreshHelper(), 20000);
  window.addEventListener("focus", onFocus);
}
function stopPolling() {
  if (--pollers > 0) return;
  if (timer) clearInterval(timer);
  timer = null;
  window.removeEventListener("focus", onFocus);
}

export function useHelperJob(trackId: string): HelperJob | undefined {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return jobs.get(trackId);
}

/** Asks the helper to let this site in (it shows a Mac dialog). */
export async function pairHelper() {
  const r = await call<{ paired: boolean }>("/pair", {}, 130000);
  await refreshHelper();
  return r.paired;
}

export const chooseHelperFolder = () => call<{ folder: string }>("/choose-folder", {}, 300000).then((r) => (void refreshHelper(), r));
export const openHelperFolder = () => call("/open-folder", {});
export const setHelperSettings = (s: { format?: HelperFormat; openAtLogin?: boolean }) => call("/settings", s).then(() => refreshHelper());
export const updateYtDlp = () => call<{ ok: boolean; message: string }>("/update-ytdlp", {}, 300000);
export const quitHelper = () => call("/quit", {}).finally(() => setTimeout(() => void refreshHelper(), 400));
export const revealJob = (jobId: string) => call("/reveal", { id: jobId });

export interface SaveMeta {
  title: string;
  artist: string;
  year?: number;
  label?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  camelot?: string;
  artwork?: string;
  source?: string;
}

/** Sends a song to the helper and follows its progress. */
export async function saveToHelper(track: Track, url: string, meta: SaveMeta) {
  const set = (j: HelperJob) => {
    jobs.set(track.id, j);
    emit();
  };
  set({ id: "", state: "queued", progress: 0 });
  try {
    const { job } = await call<{ job: HelperJob }>("/download", { url, meta });
    set(job);
    while (job.state !== "done" && job.state !== "error") {
      await new Promise((r) => setTimeout(r, 800));
      const { job: j } = await call<{ job: HelperJob }>(`/jobs/${job.id}`);
      Object.assign(job, j);
      set({ ...j });
    }
    return job;
  } catch (e) {
    const j: HelperJob = { id: "", state: "error", progress: 0, error: e instanceof Error ? e.message : "The helper didn't answer." };
    set(j);
    return j;
  }
}

/** Shows a song as waiting while it's being prepared (finding the video, reading BPM/key). */
export function markHelperJobPending(trackId: string) {
  jobs.set(trackId, { id: "", state: "queued", progress: 0 });
  emit();
}

export function clearHelperJob(trackId: string) {
  jobs.delete(trackId);
  emit();
}

/** "1.0.10" > "1.0.9" */
export function olderThan(a: string, b: string) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  return false;
}
