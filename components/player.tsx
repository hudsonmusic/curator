"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { Section, Track } from "@/lib/types";
import { bpmOf, useAnalysis } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { semitonesFromRate, shiftKey, syncRate } from "@/lib/keys";
import { Artwork } from "./artwork";
import { Waveform } from "./waveform";
import { Equalizer } from "./equalizer";
import { useSheet } from "./sheet";

interface PlayerCtx {
  track: Track | null;
  playing: boolean;
  time: number;
  duration: number;
  loop: Section | null;
  sync: boolean;
  keylock: boolean;
  rate: number;
  error: string | null;
  play: (track: Track, at?: number) => void;
  toggle: (track?: Track) => void;
  pause: () => void;
  seek: (t: number) => void;
  setLoop: (s: Section | null) => void;
  setSync: (b: boolean) => void;
  setKeylock: (b: boolean) => void;
  isPlaying: (id: string) => boolean;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer outside provider");
  return c;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loop, setLoopState] = useState<Section | null>(null);
  const [sync, setSync] = useState(false);
  const [keylock, setKeylock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loopRef = useRef<Section | null>(null);
  const trackRef = useRef<Track | null>(null);
  const playedFor = useRef(0);
  const { profile, signal } = useProfile();
  const entry = useAnalysis(track, "priority");
  const bpm = track ? bpmOf(track, entry) : undefined;
  const rate = sync && bpm ? syncRate(bpm, profile.projectBpm) : 1;

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audio.current = a;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => setDuration(a.duration || 0);
    const onErr = () => {
      setPlaying(false);
      setError("This one won't play here. Open it on its source page.");
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onPause);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onErr);
    };
  }, []);

  // Smooth progress + section looping.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const a = audio.current;
      if (a) {
        const l = loopRef.current;
        if (l && a.currentTime >= l.end) a.currentTime = l.start;
        setTime(a.currentTime);
        playedFor.current += (now - last) / 1000;
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    if (!playing || !track) return;
    const id = setTimeout(() => signal("play", track), 15000);
    return () => clearTimeout(id);
  }, [playing, track, signal]);

  useEffect(() => {
    const a = audio.current as (HTMLAudioElement & { webkitPreservesPitch?: boolean }) | null;
    if (!a) return;
    a.preservesPitch = keylock;
    a.webkitPreservesPitch = keylock;
    a.playbackRate = rate;
  }, [rate, keylock, track]);

  const play = useCallback((t: Track, at?: number) => {
    const a = audio.current;
    if (!a || !t.audioUrl) {
      a?.pause();
      trackRef.current = t;
      setTrack(t);
      setError("This one plays on its source page. Use the link in its details.");
      return;
    }
    setError(null);
    if (trackRef.current?.id !== t.id) {
      a.src = t.audioUrl;
      loopRef.current = null;
      setLoopState(null);
      setTime(0);
      playedFor.current = 0;
    }
    trackRef.current = t;
    setTrack(t);
    if (at !== undefined) {
      const go = () => { a.currentTime = at; };
      if (a.readyState >= 1) go();
      else a.addEventListener("loadedmetadata", go, { once: true });
    }
    void a.play().catch(() => {});
  }, []);

  const pause = useCallback(() => audio.current?.pause(), []);

  const toggle = useCallback(
    (t?: Track) => {
      const a = audio.current;
      if (t && t.id !== track?.id) return play(t);
      if (!a || !track?.audioUrl) return;
      if (a.paused) void a.play().catch(() => {});
      else a.pause();
    },
    [play, track],
  );

  const seek = useCallback((t: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, t);
    setTime(a.currentTime);
  }, []);

  const setLoop = useCallback((s: Section | null) => {
    loopRef.current = s;
    setLoopState(s);
  }, []);

  const isPlaying = useCallback((id: string) => playing && track?.id === id, [playing, track]);

  const value = useMemo(
    () => ({ track, playing, time, duration, loop, sync, keylock, rate, error, play, toggle, pause, seek, setLoop, setSync, setKeylock, isPlaying }),
    [track, playing, time, duration, loop, sync, keylock, rate, error, play, toggle, pause, seek, setLoop, isPlaying],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const p = usePlayer();
  const { profile, update } = useProfile();
  const sheet = useSheet();
  const entry = useAnalysis(p.track);
  const a = entry?.data;
  const shift = p.keylock ? 0 : semitonesFromRate(p.rate);
  const shownKey = a?.key ? (Math.abs(shift) >= 0.5 ? shiftKey(a.key, shift) : a.key) : null;
  const hidden = usePathname().startsWith("/welcome");

  return (
    <AnimatePresence>
      {p.track && !hidden && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-5"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-2xl border border-line bg-panel/85 p-2.5 pr-4 shadow-2xl shadow-black/60 backdrop-blur-xl sm:gap-5">
            <button
              onClick={() => p.track && sheet.open(p.track)}
              className="flex min-w-0 items-center gap-3 text-left sm:w-60"
            >
              <div className="size-11 shrink-0 overflow-hidden rounded-lg">
                <Artwork track={p.track} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.track.title}</div>
                <div className="truncate text-xs text-mute">{p.track.artist}</div>
              </div>
            </button>

            <button
              onClick={() => p.toggle()}
              aria-label={p.playing ? "Pause" : "Play"}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-ink transition-transform hover:scale-105 active:scale-95"
            >
              {p.playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
              <span className="w-10 text-right font-mono text-[11px] text-mute">{fmt(p.time)}</span>
              <div className="h-9 flex-1">
                <Waveform
                  peaks={a?.peaks}
                  seed={p.track.id}
                  progress={p.duration ? p.time / p.duration : 0}
                  sections={a?.sections}
                  duration={a?.duration ?? p.duration}
                  loop={p.loop}
                  onSeek={(f) => p.seek(f * (p.duration || 0))}
                  compact
                />
              </div>
              <span className="w-10 font-mono text-[11px] text-mute">{fmt(p.duration)}</span>
            </div>

            <div className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
              {p.playing && <Equalizer className="mr-1 hidden sm:flex" />}
              {p.loop && (
                <button onClick={() => p.setLoop(null)} className="rounded-full border border-acid/50 px-2.5 py-1 text-acid">
                  loop ×
                </button>
              )}
              <button
                onClick={() => p.setSync(!p.sync)}
                className={`rounded-full border px-2.5 py-1 transition-colors ${p.sync ? "border-acid bg-acid text-ink" : "border-line text-mute hover:text-paper"}`}
                title="Varispeed the preview to your project tempo"
              >
                sync
              </button>
              <input
                type="number"
                value={profile.projectBpm}
                min={60}
                max={200}
                onChange={(e) => update({ projectBpm: Math.max(60, Math.min(200, +e.target.value || 120)) })}
                className="w-12 rounded-md border border-line bg-transparent px-1.5 py-1 text-center text-paper outline-none focus:border-acid"
                aria-label="Project BPM"
              />
              <button
                onClick={() => p.setKeylock(!p.keylock)}
                className={`hidden rounded-full border px-2.5 py-1 transition-colors sm:block ${p.keylock ? "border-paper text-paper" : "border-line text-mute hover:text-paper"}`}
                title="Key lock: change tempo without changing pitch"
              >
                key lock
              </button>
              <span className="hidden w-28 text-right text-mute lg:block">
                {p.sync && Math.abs(shift) >= 0.05 ? `${shift > 0 ? "+" : ""}${shift.toFixed(1)} st` : ""}
                {shownKey ? ` · ${shownKey}` : ""}
              </span>
            </div>
          </div>
          <AnimatePresence>
            {p.error && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mx-auto mt-2 max-w-6xl px-2 text-center text-xs text-mute"
              >
                {p.error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PlayIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  );
}

export function PauseIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
    </svg>
  );
}
