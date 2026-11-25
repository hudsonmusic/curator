"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Track } from "./types";
import STYLE_NAMES from "./discogs-styles.json";
import { contribute } from "./sound-sync";
import { fetchAudio } from "./audio-fetch";

/**
 * Discogs styles and a "sounds like" embedding for each track, from the
 * Discogs-EffNet model running in a Web Worker. Results are kept in localStorage.
 */
export interface Style {
  /** e.g. "Deep House" */
  name: string;
  /** Discogs genre it belongs to, e.g. "Electronic" */
  genre: string;
  score: number;
}
export interface StyleData {
  top: Style[];
  /** The 1280-number embedding, quantised to bytes. Compare with similarity(). */
  emb: Int8Array;
}
type Status = "queued" | "loading" | "done" | "error";
export interface StyleEntry {
  status: Status;
  data?: StyleData;
}

const SR = 16000;
const LS = "curator:st:v1:";
const entries = new Map<string, StyleEntry>();
const listeners = new Set<() => void>();
const queue: Track[] = [];
let running = false;
let version = 0;

const CLASSES = (STYLE_NAMES as string[]).map((c) => {
  const [genre, name] = c.split("---");
  return { genre, name };
});

/** Tracks the model can hear: previews and SoundCloud streams. */
export const styleable = (t: Track) => !!t.audioUrl;

function set(id: string, e: StyleEntry) {
  entries.set(id, e);
  version++;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const toB64 = (a: Int8Array) => {
  let s = "";
  const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
};
const fromB64 = (s: string) => {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Int8Array(u.buffer);
};

export function getStyles(id: string): StyleEntry | undefined {
  const hit = entries.get(id);
  if (hit) return hit;
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(LS + id);
    if (raw) {
      const j = JSON.parse(raw) as { t: [string, string, number][]; e: string };
      const e: StyleEntry = { status: "done", data: { top: j.t.map(([name, genre, score]) => ({ name, genre, score })), emb: fromB64(j.e) } };
      entries.set(id, e);
      return e;
    }
  } catch {}
  return undefined;
}

let worker: Worker | null = null;
let jobId = 0;
const pending = new Map<number, { resolve: (r: { scores: Float32Array; emb: Float32Array }) => void; reject: (e: Error) => void }>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./styles.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent) => {
      const { id, scores, emb, error } = e.data as { id: number; scores?: Float32Array; emb?: Float32Array; error?: string };
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (scores && emb) p.resolve({ scores, emb });
      else p.reject(new Error(error ?? "style model failed"));
    };
  }
  return worker;
}

async function decode16k(buf: ArrayBuffer): Promise<Float32Array> {
  const Ctx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const audio = await new Ctx(1, SR, SR).decodeAudioData(buf);
  const n = Math.min(audio.length, SR * 60);
  const out = new Float32Array(n);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / audio.numberOfChannels;
  }
  return out;
}

function summarise(scores: Float32Array, emb: Float32Array): StyleData {
  const seen = new Set<string>();
  const top: Style[] = [];
  for (const i of [...scores.keys()].sort((a, b) => scores[b] - scores[a])) {
    const c = CLASSES[i];
    // "Ska" exists under both Reggae and Rock; keep the stronger one.
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    top.push({ name: c.name, genre: c.genre, score: Math.round(scores[i] * 1000) / 1000 });
    if (top.length >= 8) break;
  }
  let max = 1e-9;
  for (const v of emb) max = Math.max(max, Math.abs(v));
  const q = Int8Array.from(emb, (v) => Math.round((v / max) * 127));
  return { top, emb: q };
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const track = queue.shift()!;
    set(track.id, { status: "loading" });
    try {
      const samples = await decode16k(await fetchAudio(track, 60));
      const id = ++jobId;
      const out = await new Promise<{ scores: Float32Array; emb: Float32Array }>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        getWorker().postMessage({ id, samples }, [samples.buffer]);
      });
      const data = summarise(out.scores, out.emb);
      set(track.id, { status: "done", data });
      contribute(track, data);
      try {
        localStorage.setItem(LS + track.id, JSON.stringify({ t: data.top.map((s) => [s.name, s.genre, s.score]), e: toB64(data.emb) }));
      } catch {}
    } catch {
      set(track.id, { status: "error" });
    }
  }
  running = false;
}

export function requestStyles(track: Track, priority = false) {
  if (!styleable(track)) return;
  const e = getStyles(track.id);
  if (e && e.status !== "queued") return;
  const idx = queue.findIndex((t) => t.id === track.id);
  if (idx >= 0) {
    if (!priority) return;
    queue.splice(idx, 1);
  }
  if (priority) queue.unshift(track);
  else queue.push(track);
  set(track.id, { status: "queued" });
  void pump();
}

/** Resolves once a track has been heard (or can't be), waiting up to `ms`. */
export function waitForStyles(track: Track, ms = 20000): Promise<StyleEntry | undefined> {
  if (!styleable(track)) return Promise.resolve(undefined);
  const settled = () => {
    const s = getStyles(track.id)?.status;
    return s === "done" || s === "error";
  };
  if (settled()) return Promise.resolve(getStyles(track.id));
  requestStyles(track, true);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      unsub();
      resolve(getStyles(track.id));
    };
    const unsub = subscribe(() => settled() && finish());
    const timer = setTimeout(finish, ms);
  });
}

export function useStyles(track: Track | null | undefined, auto: boolean | "priority" = false) {
  const id = track?.id;
  const entry = useSyncExternalStore(subscribe, () => (id ? getStyles(id) : undefined), () => undefined);
  useEffect(() => {
    if (track && auto) requestStyles(track, auto === "priority");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, auto]);
  return entry;
}

/** Re-render whenever a track's styles arrive. */
export function useStylesVersion() {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

/** How alike two tracks sound, 0–1 (cosine of their embeddings), or undefined if unknown. */
export function similarity(a: string, b: string): number | undefined {
  const ea = getStyles(a)?.data?.emb, eb = getStyles(b)?.data?.emb;
  if (!ea || !eb) return undefined;
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < ea.length; i++) {
    d += ea[i] * eb[i];
    na += ea[i] * ea[i];
    nb += eb[i] * eb[i];
  }
  return na && nb ? d / Math.sqrt(na * nb) : undefined;
}

/** The track's strongest style, if the model has heard it. */
export const topStyle = (id: string) => getStyles(id)?.data?.top[0];
