"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Analysis, Track } from "./types";
import { camelotOf } from "./keys";

export type Status = "queued" | "loading" | "done" | "error";
export interface Entry {
  status: Status;
  data?: Analysis;
}

const SR = 22050;
const LS = "curator:an:v1:";
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const queue: { track: Track; priority: boolean }[] = [];
let running = false;

let version = 0;
export const getVersion = () => version;

function set(id: string, e: Entry) {
  entries.set(id, e);
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getEntry(id: string): Entry | undefined {
  const hit = entries.get(id);
  if (hit) return hit;
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(LS + id);
    if (raw) {
      const e: Entry = { status: "done", data: JSON.parse(raw) };
      entries.set(id, e);
      return e;
    }
  } catch {}
  return undefined;
}

let worker: Worker | null = null;
let jobId = 0;
const pending = new Map<number, { resolve: (a: Analysis) => void; reject: (e: Error) => void }>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./analysis.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent) => {
      const { id, res, error } = e.data as { id: number; res?: Analysis; error?: string };
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (res) p.resolve(res);
      else p.reject(new Error(error ?? "analysis failed"));
    };
  }
  return worker;
}

async function decode(buf: ArrayBuffer): Promise<Float32Array> {
  const Ctx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new Ctx(1, SR, SR);
  const audio = await ctx.decodeAudioData(buf);
  const n = Math.min(audio.length, SR * 180);
  const out = new Float32Array(n);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / audio.numberOfChannels;
  }
  return out;
}

async function analyzeBuffer(buf: ArrayBuffer, hintBpm?: number, hintKey?: string): Promise<Analysis> {
  const samples = await decode(buf);
  const id = ++jobId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, samples, sr: SR, hintBpm, hintKey }, [samples.buffer]);
  });
}

export async function analyzeFile(file: File): Promise<Analysis> {
  return analyzeBuffer(await file.arrayBuffer());
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const { track } = queue.shift()!;
    set(track.id, { status: "loading" });
    try {
      if (!track.audioUrl) throw new Error("no audio");
      const res = await fetch(track.audioUrl);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const data = await analyzeBuffer(await res.arrayBuffer(), track.sourceBpm, track.sourceKey);
      if (!data.camelot) data.camelot = camelotOf(data.key) ?? "";
      set(track.id, { status: "done", data });
      try {
        localStorage.setItem(LS + track.id, JSON.stringify(data));
      } catch {}
    } catch {
      set(track.id, { status: "error" });
    }
  }
  running = false;
}

export function requestAnalysis(track: Track, priority = false) {
  if (!track.audioUrl) return;
  const e = getEntry(track.id);
  if (e && (e.status === "done" || e.status === "loading" || e.status === "error")) return;
  const idx = queue.findIndex((q) => q.track.id === track.id);
  if (idx >= 0) {
    if (!priority) return;
    queue.splice(idx, 1);
  }
  if (priority) queue.unshift({ track, priority });
  else queue.push({ track, priority });
  set(track.id, { status: "queued" });
  void pump();
}

/** Analysis state for a track. auto: start analysing it; "priority" jumps the queue. */
export function useAnalysis(track: Track | null | undefined, auto: boolean | "priority" = false) {
  const id = track?.id;
  const entry = useSyncExternalStore(
    subscribe,
    () => (id ? getEntry(id) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (track && auto) requestAnalysis(track, auto === "priority");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, auto]);
  return entry;
}

/** Re-render whenever any analysis finishes. */
export function useAnalysisVersion() {
  return useSyncExternalStore(subscribe, getVersion, () => 0);
}

export function bpmOf(track: Track, entry?: Entry): number | undefined {
  return entry?.data?.bpm ?? track.sourceBpm;
}
