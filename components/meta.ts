"use client";

import type { SampleType, Track } from "@/lib/types";
import { bpmOf, getEntry, useAnalysis } from "@/lib/analysis-store";
import { camelotCompatible, camelotOf } from "@/lib/keys";
import { topStyle, type Style } from "@/lib/style-store";

export const TYPE_LABEL: Record<SampleType, string> = { acapella: "Acapella", loop: "Loop", song: "Song" };

export interface Meta {
  bpm?: number;
  key?: string;
  cam?: string;
  analyzing: boolean;
  /** The Discogs style the model hears, when it has listened. */
  style?: Style;
  /** What to show as the genre: the heard style, else the source's genre. */
  genre?: string;
}

export function metaOf(track: Track): Meta {
  const e = getEntry(track.id);
  const bpm = bpmOf(track, e);
  const key = e?.data?.key ?? track.sourceKey;
  const cam = e?.data?.camelot || (key ? camelotOf(key) ?? undefined : undefined);
  const style = topStyle(track.id);
  return { bpm, key, cam, analyzing: e?.status === "queued" || e?.status === "loading", style, genre: style?.name ?? track.genre };
}

export function useTrackMeta(track: Track): Meta {
  useAnalysis(track);
  return metaOf(track);
}

export interface Filters {
  type: "all" | SampleType;
  bpmLo: number | null;
  bpmHi: number | null;
  /** Also match at half or double the BPM. */
  halfDouble: boolean;
  key: string | null;
  keyMode: "exact" | "compatible";
  decades: number[];
  genres: string[];
}

export const EMPTY_FILTERS: Filters = {
  type: "all",
  bpmLo: null,
  bpmHi: null,
  halfDouble: true,
  key: null,
  keyMode: "compatible",
  decades: [],
  genres: [],
};

export function filtersActive(f: Filters) {
  return f.type !== "all" || f.bpmLo !== null || f.bpmHi !== null || !!f.key || f.decades.length > 0 || f.genres.length > 0;
}

/** Applies filters. Tracks still being analysed are counted separately when a BPM/key filter needs them. */
export function applyFilters(tracks: Track[], f: Filters): { shown: Track[]; waiting: number } {
  let waiting = 0;
  const needsAudio = f.bpmLo !== null || f.bpmHi !== null || !!f.key;
  const shown = tracks.filter((t) => {
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.decades.length && !(t.year && f.decades.includes(Math.floor(t.year / 10) * 10))) return false;
    if (f.genres.length) {
      const g = metaOf(t).genre;
      if (!(g && f.genres.includes(g))) return false;
    }
    if (!needsAudio) return true;
    // Deep cuts with no preview can't be measured; keep them (their group says BPM is unknown).
    if (t.deep && !t.audioUrl) return true;
    const m = metaOf(t);
    if (f.bpmLo !== null || f.bpmHi !== null) {
      if (!m.bpm) {
        if (m.analyzing || (t.audioUrl && !getEntry(t.id))) waiting++;
        return false;
      }
      const lo = f.bpmLo ?? 0, hi = f.bpmHi ?? 999;
      const cands = f.halfDouble ? [m.bpm, m.bpm * 2, m.bpm / 2] : [m.bpm];
      if (!cands.some((b) => b >= lo && b <= hi)) return false;
    }
    if (f.key) {
      if (!m.cam) {
        if (m.analyzing || (t.audioUrl && !getEntry(t.id))) waiting++;
        return false;
      }
      if (f.keyMode === "exact" ? m.cam !== f.key : !camelotCompatible(m.cam, f.key)) return false;
    }
    return true;
  });
  return { shown, waiting };
}
