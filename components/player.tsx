"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Section, Track } from "@/lib/types";
import { bpmOf, useAnalysis } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { semitonesFromRate, shiftKey, syncRate } from "@/lib/keys";
import { Artwork } from "./artwork";
import { Waveform } from "./waveform";
import { Equalizer } from "./equalizer";
import { useSheet } from "./sheet";
import { fullVersion, scConnected, useScStatus } from "@/lib/soundcloud-client";

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
  /** queue: the list this track was played from; playback continues through it. */
  play: (track: Track, at?: number, queue?: Track[]) => void;
  toggle: (track?: Track) => void;
  pause: () => void;
  seek: (t: number) => void;
  setLoop: (s: Section | null) => void;
  setSync: (b: boolean) => void;
  setKeylock: (b: boolean) => void;
  isPlaying: (id: string) => boolean;
  muted: boolean;
  setMuted: (m: boolean) => void;
  /** Prefer full-length SoundCloud versions of songs. */
  full: boolean;
  setFull: (f: boolean) => void;
  /** The SoundCloud track actually playing, when playing a full version. */
  fullSource: Track | null;
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
  const [muted, setMutedState] = useState(false);
  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    try {
      localStorage.setItem("curator:muted", m ? "1" : "0");
    } catch {}
  }, []);
  useEffect(() => {
    // ?mute in the address forces mute (handy for testing); otherwise remember the last choice.
    let m = false;
    try {
      m = new URLSearchParams(location.search).has("mute") || localStorage.getItem("curator:muted") === "1";
    } catch {}
    setMutedState(m);
  }, []);
  useEffect(() => {
    if (audio.current) audio.current.muted = muted;
  }, [muted]);
  const loopRef = useRef<Section | null>(null);
  const trackRef = useRef<Track | null>(null);
  const playSeq = useRef(0);
  const [full, setFullState] = useState(true);
  const fullRef = useRef(true);
  const [fullSource, setFullSource] = useState<Track | null>(null);
  const setFull = useCallback((f: boolean) => {
    fullRef.current = f;
    setFullState(f);
    try {
      localStorage.setItem("curator:full", f ? "1" : "0");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const f = localStorage.getItem("curator:full") !== "0";
      fullRef.current = f;
      setFullState(f);
    } catch {}
  }, []);
  const queueRef = useRef<Track[]>([]);
  const playRef = useRef<(t: Track, at?: number, queue?: Track[]) => void>(() => {});
  const playedFor = useRef(0);
  const { profile, signal } = useProfile();
  const entry = useAnalysis(track, "priority");
  const bpm = track ? bpmOf(track, entry) : undefined;
  const rate = sync && bpm ? syncRate(bpm, profile.projectBpm) : 1;

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    try {
      a.muted = new URLSearchParams(location.search).has("mute") || localStorage.getItem("curator:muted") === "1";
    } catch {}
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
    // Auto-advance: next playable track in the queue, or a new random pick.
    const onEnded = () => {
      onPause();
      const q = queueRef.current;
      const i = q.findIndex((x) => x.id === trackRef.current?.id);
      const next = i >= 0 ? q.slice(i + 1).find((x) => x.audioUrl) : undefined;
      if (next) playRef.current(next, undefined, q);
      else window.dispatchEvent(new Event("curator:queue-end"));
    };
    a.addEventListener("ended", onEnded);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
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

  const play = useCallback((t: Track, at?: number, queue?: Track[]) => {
    if (queue) queueRef.current = queue;
    const a = audio.current;
    const seq = ++playSeq.current;
    // Full-length playback via SoundCloud for songs, unless jumping to a preview-timed spot.
    const wantFull = fullRef.current && at === undefined && t.type === "song" && t.source !== "soundcloud" && scConnected();
    if (!a || (!t.audioUrl && !wantFull)) {
      a?.pause();
      trackRef.current = t;
      setTrack(t);
      setError("This one plays on its source page. Use the link in its details.");
      return;
    }
    setError(null);
    const sameTrack = trackRef.current?.id === t.id;
    trackRef.current = t;
    setTrack(t);
    const start = (src: string | undefined, full: Track | null) => {
      if (seq !== playSeq.current) return; // a newer play() won
      if (!src) {
        setError("No playable version found.");
        return;
      }
      if (!sameTrack || a.getAttribute("src") !== src) {
        a.src = src;
        loopRef.current = null;
        setLoopState(null);
        setTime(0);
        playedFor.current = 0;
      }
      setFullSource(full);
      if (at !== undefined) {
        const go = () => { a.currentTime = at; };
        if (a.readyState >= 1 && sameTrack) go();
        else a.addEventListener("loadedmetadata", go, { once: true });
      }
      void a.play().catch(() => {});
    };
    if (wantFull) {
      if (!sameTrack) a.pause();
      void fullVersion(t).then((sc) => start(sc?.audioUrl ?? t.audioUrl, sc?.audioUrl ? sc : null));
    } else {
      start(t.audioUrl, null);
    }
  }, []);

  playRef.current = play;
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
    () => ({ track, playing, time, duration, loop, sync, keylock, rate, error, play, toggle, pause, seek, setLoop, setSync, setKeylock, isPlaying, muted, setMuted, full, setFull, fullSource }),
    [track, playing, time, duration, loop, sync, keylock, rate, error, play, toggle, pause, seek, setLoop, isPlaying, muted, setMuted, full, setFull, fullSource],
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
  const sc = useScStatus();
  // The preview's waveform and sections don't line up with a full-length version.
  const preview = !p.fullSource;

  return (
    <AnimatePresence>
      {p.track && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3"
        >
          <div className="glass-strong mx-auto flex h-16 max-w-5xl items-center gap-3 rounded-2xl border border-white/[0.1] px-3 shadow-[0_20px_50px_rgb(0_0_0/0.55)] sm:gap-5">
            <button
              onClick={() => p.track && sheet.open(p.track)}
              className="flex min-w-0 items-center gap-3 text-left sm:w-60"
            >
              <div className="size-11 shrink-0 overflow-hidden rounded-lg shadow-[0_2px_8px_rgb(0_0_0/0.4)]">
                <Artwork track={p.track} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.track.title}</div>
                <div className="truncate text-xs text-mute">
                  {p.track.artist}
                  {p.fullSource ? (
                    <span className="ml-1.5 text-accent">· full via SoundCloud</span>
                  ) : p.track.previewOnly ? (
                    <span className="ml-1.5">· preview</span>
                  ) : null}
                </div>
              </div>
            </button>

            <button
              onClick={() => p.toggle()}
              aria-label={p.playing ? "Pause" : "Play"}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-ink shadow-[0_2px_8px_rgb(0_0_0/0.4)] transition-transform duration-150 hover:scale-105 active:scale-90"
            >
              {p.playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
              <span className="w-10 text-right font-mono text-[11px] text-mute">{fmt(p.time)}</span>
              <div className="h-9 flex-1">
                <Waveform
                  peaks={preview ? a?.peaks : undefined}
                  seed={p.track.id}
                  progress={p.duration ? p.time / p.duration : 0}
                  sections={preview ? a?.sections : undefined}
                  duration={preview ? (a?.duration ?? p.duration) : p.duration}
                  loop={p.loop}
                  onSeek={(f) => p.seek(f * (p.duration || 0))}
                  compact
                />
              </div>
              <span className="w-10 font-mono text-[11px] text-mute">{fmt(p.duration)}</span>
            </div>

            <div className="ml-auto flex items-center gap-2 text-[12px]">
              {p.playing && !p.muted && <Equalizer className="mr-1 hidden sm:flex" />}
              {sc?.connected && (
                <button
                  onClick={() => {
                    p.setFull(!p.full);
                    if (p.track) p.play(p.track);
                  }}
                  className={`btn ${p.full ? "btn-on" : ""}`}
                  title="Play full tracks through SoundCloud when a match is found"
                >
                  Full
                </button>
              )}
              <button
                onClick={() => p.setMuted(!p.muted)}
                className={`btn px-2 ${p.muted ? "btn-on" : ""}`}
                aria-label={p.muted ? "Unmute" : "Mute"}
                title={p.muted ? "Unmute" : "Mute"}
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
                  <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
                  {p.muted ? (
                    <path d="M10.5 5.5l4 5m0-5l-4 5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  ) : (
                    <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  )}
                </svg>
              </button>
              {p.loop && (
                <button onClick={() => p.setLoop(null)} className="btn btn-on">
                  Loop ×
                </button>
              )}
              <button
                onClick={() => p.setSync(!p.sync)}
                className={`btn ${p.sync ? "btn-on" : ""}`}
                title="Varispeed the preview to your project tempo"
              >
                Sync
              </button>
              <input
                type="number"
                value={profile.projectBpm}
                min={60}
                max={200}
                onChange={(e) => update({ projectBpm: Math.max(60, Math.min(200, +e.target.value || 120)) })}
                className="field w-12 text-center font-mono"
                aria-label="Project BPM"
              />
              <button
                onClick={() => p.setKeylock(!p.keylock)}
                className={`btn hidden sm:inline-flex ${p.keylock ? "btn-on" : ""}`}
                title="Key lock: change tempo without changing pitch"
              >
                Key lock
              </button>
              <span className="hidden w-28 text-right font-mono text-[11px] text-mute lg:block">
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
                className="mx-auto mb-1 w-fit rounded-full bg-black/70 px-3 py-1 text-center text-xs text-paper/80 backdrop-blur"
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
