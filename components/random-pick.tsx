"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CrateDef, Track } from "@/lib/types";
import { useAnalysis } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { Artwork } from "./artwork";
import { PauseIcon, PlayIcon, usePlayer } from "./player";
import { useSheet } from "./sheet";
import { metaOf } from "./meta";

/** One random song from your switched-on crates. R for another. */
export function RandomPick({ crates, decades }: { crates: CrateDef[]; decades: number[] }) {
  const { profile, saved, toggleSave } = useProfile();
  const player = usePlayer();
  const sheet = useSheet();
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(false);
  const seen = useRef<string[]>([]);
  useAnalysis(track, true);
  const m = track ? metaOf(track) : null;
  const key = crates.map((c) => c.id + c.artists.length).join() + decades.join();

  const roll = useCallback(async () => {
    if (!crates.length) return setTrack(null);
    setLoading(true);
    try {
      const res = await fetch("/api/random", {
        method: "POST",
        body: JSON.stringify({ crates, decades, exclude: [...seen.current, ...profile.disliked] }),
      });
      const { track } = (await res.json()) as { track: Track | null };
      if (track) seen.current = [...seen.current.slice(-50), track.id];
      setTrack(track);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void roll();
  }, [roll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || sheet.track) return;
      if (e.key === "r") void roll();
      if (e.key === "p" && track) player.toggle(track);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const playing = track ? player.isPlaying(track.id) : false;

  return (
    <div className="flex items-center gap-4 border-b border-line px-3 py-3">
      <div className="hidden w-20 shrink-0 font-mono text-[10px] uppercase leading-tight tracking-wider text-mute sm:block">
        Random
        <br />
        pick
      </div>
      <div className="relative size-16 shrink-0 overflow-hidden rounded">
        {track ? <Artwork track={track} /> : <div className="size-full animate-pulse bg-panel" />}
        {loading && track && <div className="absolute inset-0 animate-pulse bg-ink/60" />}
      </div>
      <div className="min-w-0 flex-1">
        {track ? (
          <>
            <button onClick={() => sheet.open(track)} className="block max-w-full truncate text-left text-base font-medium hover:underline">
              {track.title}
            </button>
            <div className="truncate text-sm text-mute">{track.artist}</div>
            <div className="mt-1 flex gap-3 font-mono text-[11px] uppercase tracking-wider text-mute">
              <span>{track.year ?? "—"}</span>
              <span className="truncate">{track.genre}</span>
              <span className="text-paper">{m?.bpm ? `${Math.round(m.bpm)} bpm` : m?.analyzing ? "··· bpm" : ""}</span>
              <span className="text-paper">{m?.cam ? `${m.cam} ${m.key}` : ""}</span>
            </div>
          </>
        ) : (
          <div className="text-sm text-mute">{crates.length ? (loading ? "Pulling a record…" : "Nothing found. Try again.") : "Switch on a crate to get picks."}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {track && (
          <>
            <button
              onClick={() => player.toggle(track)}
              className="grid size-9 place-items-center rounded-full bg-paper text-ink hover:bg-acid"
              aria-label={playing ? "Pause" : "Play"}
              title="Play (P)"
            >
              {playing ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
            </button>
            <button
              onClick={() => toggleSave(track)}
              className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider ${saved[track.id] ? "border-acid text-acid" : "border-line text-mute hover:text-paper"}`}
            >
              {saved[track.id] ? "saved" : "save"}
            </button>
          </>
        )}
        <button
          onClick={() => void roll()}
          disabled={loading}
          className="rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-mute hover:border-paper hover:text-paper disabled:opacity-50"
          title="Another one (R)"
        >
          ↻ next <span className="hidden text-mute/60 sm:inline">r</span>
        </button>
      </div>
    </div>
  );
}
