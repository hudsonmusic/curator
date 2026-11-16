"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CrateDef, Track } from "@/lib/types";
import { useAnalysis } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { Artwork } from "./artwork";
import { PauseIcon, PlayIcon, usePlayer } from "./player";
import { useSheet } from "./sheet";
import { metaOf } from "./meta";

/** One random song from your switched-on crates. R (or Next) rolls a new one and plays it. */
export function RandomPick({ crates, decades }: { crates: CrateDef[]; decades: number[] }) {
  const { profile, saved, toggleSave } = useProfile();
  const player = usePlayer();
  const sheet = useSheet();
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(false);
  const seen = useRef<string[]>([]);
  const reqId = useRef(0);
  useAnalysis(track, true);
  const m = track ? metaOf(track) : null;
  const key = crates.map((c) => c.id + c.artists.length).join() + decades.join();

  const roll = useCallback(
    async (autoplay: boolean) => {
      if (!crates.length) return setTrack(null);
      const id = ++reqId.current;
      setLoading(true);
      try {
        const res = await fetch("/api/random", {
          method: "POST",
          body: JSON.stringify({ crates, decades, exclude: [...seen.current, ...profile.disliked] }),
        });
        const { track } = (await res.json()) as { track: Track | null };
        if (id !== reqId.current) return; // a newer roll won
        if (track) seen.current = [...seen.current.slice(-50), track.id];
        setTrack(track);
        if (autoplay && track?.audioUrl) player.play(track);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, player.play],
  );

  useEffect(() => {
    void roll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || sheet.track || e.metaKey || e.ctrlKey) return;
      if (e.key === "r") void roll(true);
      if (e.key === "p" && track) player.toggle(track);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const playing = track ? player.isPlaying(track.id) : false;

  return (
    <div className="relative mx-3 mt-3 overflow-hidden rounded-xl border border-line bg-white/[0.03]">
      {/* Blurred cover behind the card, like a now-playing widget. */}
      <AnimatePresence>
        {track?.artwork && (
          <motion.div
            key={track.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute inset-0 scale-150 bg-cover bg-center blur-3xl saturate-150"
            style={{ backgroundImage: `url(${track.artwork})` }}
          />
        )}
      </AnimatePresence>
      <div className="relative flex items-center gap-4 p-3">
        <div className="relative size-[72px] shrink-0">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={track?.id ?? "empty"}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="absolute inset-0 overflow-hidden rounded-lg shadow-[0_6px_20px_rgb(0_0_0/0.45)]"
            >
              {track ? <Artwork track={track} /> : <div className="size-full animate-pulse bg-white/[0.06]" />}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <div className="label mb-0.5">Random pick</div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={track?.id ?? "none"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              {track ? (
                <>
                  <button onClick={() => sheet.open(track)} className="block max-w-full truncate text-left text-[15px] font-semibold hover:underline">
                    {track.title}
                  </button>
                  <div className="truncate text-[13px] text-paper/70">{track.artist}</div>
                  <div className="mt-1 flex gap-3 font-mono text-[11px] text-mute">
                    <span>{track.year ?? "—"}</span>
                    <span className="truncate font-sans">{track.genre}</span>
                    <span className="text-paper/90">{m?.bpm ? `${Math.round(m.bpm)} BPM` : m?.analyzing ? "··· BPM" : ""}</span>
                    <span className="text-paper/90">{m?.cam ? `${m.cam} · ${m.key}` : ""}</span>
                  </div>
                </>
              ) : (
                <div className="py-2 text-[13px] text-mute">
                  {crates.length ? (loading ? "Pulling a record…" : "Nothing found. Try again.") : "Switch on a crate to get picks."}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {track && (
            <>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => player.toggle(track)}
                className="grid size-9 place-items-center rounded-full bg-paper text-ink shadow-[0_2px_8px_rgb(0_0_0/0.4)] transition-colors hover:bg-white"
                aria-label={playing ? "Pause" : "Play"}
                title="Play (P)"
              >
                {playing ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
              </motion.button>
              <button onClick={() => toggleSave(track)} className={`btn ${saved[track.id] ? "btn-on" : ""}`}>
                {saved[track.id] ? "Saved" : "Save"}
              </button>
            </>
          )}
          <button onClick={() => void roll(true)} disabled={loading && !track} className="btn" title="Next random song (R)">
            <motion.span animate={{ rotate: loading ? 360 : 0 }} transition={loading ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}>
              ↻
            </motion.span>
            Next
            <kbd className="ml-0.5 rounded bg-white/[0.08] px-1 font-mono text-[10px] text-mute">R</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
