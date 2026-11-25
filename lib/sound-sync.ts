"use client";

import type { Track } from "./types";
import type { StyleData } from "./style-store";

/**
 * Every song this browser fingerprints joins the shared sound index, so "Similar songs"
 * can find it for everyone. Uploads are batched; each song is sent once per browser.
 */
const SENT = "curator:idx:v1";
const queue: { track: Track; emb: string; style?: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sent: Set<string> | null = null;
let total = 0;
const listeners = new Set<(n: number) => void>();

function sentSet() {
  if (!sent) {
    try {
      sent = new Set(JSON.parse(localStorage.getItem(SENT) ?? "[]"));
    } catch {
      sent = new Set();
    }
  }
  return sent;
}

function remember(ids: string[]) {
  const s = sentSet();
  ids.forEach((id) => s.add(id));
  try {
    localStorage.setItem(SENT, JSON.stringify([...s].slice(-20000)));
  } catch {}
}

const toB64 = (a: Int8Array) => {
  let s = "";
  const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
};

/** Songs the index can use: full songs we can play again (an Apple preview, SoundCloud or YouTube). */
const indexable = (t: Track) => t.type === "song" && (!!t.audioUrl || !!t.youtubeId);

/** How many songs this browser has added to the index this visit. */
export function onIndexed(fn: (n: number) => void) {
  listeners.add(fn);
  fn(total);
  return () => listeners.delete(fn);
}

async function flush() {
  timer = null;
  const batch = queue.splice(0, 40);
  if (!batch.length) return;
  try {
    const res = await fetch("/api/sounds/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: batch.map((b) => ({ ...b, track: { ...b.track, tags: [] } })) }),
    });
    if (res.ok) {
      const { added } = (await res.json()) as { added: number };
      total += added;
      listeners.forEach((l) => l(total));
      remember(batch.map((b) => b.track.id));
    }
  } catch {}
  if (queue.length) timer = setTimeout(flush, 1500);
}

export function contribute(track: Track, data: StyleData) {
  if (typeof window === "undefined" || !indexable(track) || sentSet().has(track.id)) return;
  if (queue.some((q) => q.track.id === track.id)) return;
  queue.push({ track, emb: toB64(data.emb), style: data.top[0]?.name });
  timer ??= setTimeout(flush, 4000);
}

export const embB64 = toB64;
