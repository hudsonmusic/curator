"use client";

import type { Track } from "./types";
import { requestStyles, waitForStyles } from "./style-store";
import { onIndexed } from "./sound-sync";

/**
 * "Grow the sound index": while curator is open, keep digging up records the index
 * doesn't have yet, listen to their previews, and add their fingerprints. Every
 * fingerprint goes in through the same path as songs you play (lib/sound-sync.ts).
 */
type State = { running: boolean; heard: number; added: number; status: string };
let state: State = { running: false, heard: 0, added: 0, status: "Off" };
const listeners = new Set<(s: State) => void>();
const emit = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};
let stopFlag = false;
let loop: Promise<void> | null = null;
let addedAtStart = 0;
let addedNow = 0;
if (typeof window !== "undefined") onIndexed((n) => {
  addedNow = n;
  if (state.running) emit({ added: n - addedAtStart });
});

export function onGrow(fn: (s: State) => void) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  let empty = 0;
  while (!stopFlag) {
    emit({ status: "Digging for records the index doesn't have…" });
    let tracks: Track[] = [];
    try {
      const res = await fetch(`/api/sounds/crawl?seed=${Date.now()}`);
      tracks = ((await res.json()) as { tracks: Track[] }).tracks ?? [];
    } catch {}
    if (stopFlag) break;
    if (!tracks.length) {
      empty++;
      emit({ status: "Nothing new in that corner, trying another…" });
      await pause(Math.min(60000, 5000 * empty));
      continue;
    }
    empty = 0;
    emit({ status: `Listening to ${tracks.length} new records…` });
    for (const t of tracks) requestStyles(t);
    for (const t of tracks) {
      if (stopFlag) break;
      const e = await waitForStyles(t, 60000);
      if (e?.status === "done") emit({ heard: state.heard + 1 });
    }
    // Be gentle with Apple and MusicBrainz.
    await pause(8000);
  }
  emit({ running: false, status: "Off" });
}

export function startGrowing() {
  if (state.running) return;
  stopFlag = false;
  addedAtStart = addedNow;
  emit({ running: true, heard: 0, added: 0 });
  loop = run().finally(() => (loop = null));
}

export function stopGrowing() {
  stopFlag = true;
  emit({ status: "Stopping…" });
  if (!loop) emit({ running: false, status: "Off" });
}
