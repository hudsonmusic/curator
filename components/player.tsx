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
import { useConfig } from "@/lib/config";
import { findVideo, loadYouTubeApi, type YTPlayer } from "./youtube";

export interface FullSource {
  via: "youtube" | "soundcloud";
  url: string;
}

interface PlayOpts {
  /** Seek within the full-length version rather than the preview. */
  full?: boolean;
}

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
  play: (track: Track, at?: number, queue?: Track[], opts?: PlayOpts) => void;
  toggle: (track?: Track) => void;
  pause: () => void;
  seek: (t: number) => void;
  setLoop: (s: Section | null) => void;
  setSync: (b: boolean) => void;
  setKeylock: (b: boolean) => void;
  isPlaying: (id: string) => boolean;
  muted: boolean;
  setMuted: (m: boolean) => void;
  /** Prefer full-length versions of songs (YouTube, then SoundCloud). */
  full: boolean;
  setFull: (f: boolean) => void;
  /** Where the full-length version is coming from, when playing one. */
  fullSource: FullSource | null;
  /** Whether any full-length service is available. */
  fullAvailable: boolean;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer outside provider");
  return c;
}

type Engine = "audio" | "yt";

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
  const [engine, setEngineState] = useState<Engine>("audio");
  const engineRef = useRef<Engine>("audio");
  const setEngine = (e: Engine) => {
    engineRef.current = e;
    setEngineState(e);
  };
  const yt = useRef<YTPlayer | null>(null);
  const ytReady = useRef<Promise<YTPlayer> | null>(null);
  const ytHost = useRef<HTMLDivElement>(null);
  const ytVideo = useRef<string | null>(null);
  const config = useConfig();
  const sc = useScStatus();
  const ytOn = useRef(false);
  ytOn.current = !!config?.youtube;

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
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  useEffect(() => {
    if (audio.current) audio.current.muted = muted;
    try {
      if (muted) yt.current?.mute();
      else yt.current?.unMute();
    } catch {}
  }, [muted]);

  const loopRef = useRef<Section | null>(null);
  const trackRef = useRef<Track | null>(null);
  const playSeq = useRef(0);
  const [full, setFullState] = useState(true);
  const fullRef = useRef(true);
  const [fullSource, setFullSource] = useState<FullSource | null>(null);
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
  const playRef = useRef<(t: Track, at?: number, queue?: Track[], opts?: PlayOpts) => void>(() => {});
  const playedFor = useRef(0);
  const { profile, signal } = useProfile();
  const entry = useAnalysis(track, "priority");
  const bpm = track ? bpmOf(track, entry) : undefined;
  const rate = sync && bpm ? syncRate(bpm, profile.projectBpm) : 1;

  // Auto-advance: next playable track in the queue, or a new random pick.
  const onEnded = useRef(() => {});
  onEnded.current = () => {
    setPlaying(false);
    const q = queueRef.current;
    const i = q.findIndex((x) => x.id === trackRef.current?.id);
    const next = i >= 0 ? q.slice(i + 1).find((x) => x.audioUrl) : undefined;
    if (next) playRef.current(next, undefined, q);
    else window.dispatchEvent(new Event("curator:queue-end"));
  };

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    try {
      a.muted = new URLSearchParams(location.search).has("mute") || localStorage.getItem("curator:muted") === "1";
    } catch {}
    audio.current = a;
    const onPlay = () => engineRef.current === "audio" && setPlaying(true);
    const onPause = () => engineRef.current === "audio" && setPlaying(false);
    const onMeta = () => engineRef.current === "audio" && setDuration(a.duration || 0);
    const onEnd = () => engineRef.current === "audio" && onEnded.current();
    const onErr = () => {
      if (engineRef.current !== "audio" || !a.getAttribute("src")) return;
      setPlaying(false);
      setError("This one won't play here. Open it on its source page.");
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onErr);
    };
  }, []);

  /** Creates the YouTube player inside the mini window, once. */
  const ensureYt = useCallback((): Promise<YTPlayer> => {
    ytReady.current ??= loadYouTubeApi().then(
      () =>
        new Promise<YTPlayer>((resolve) => {
          const el = document.createElement("div");
          ytHost.current!.appendChild(el);
          const player = new window.YT!.Player(el, {
            width: "100%",
            height: "100%",
            // The player bar does play/seek/mute, so YouTube's own controls, captions and cards are hidden.
            playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 0 },
            events: {
              onReady: () => {
                yt.current = player;
                if (mutedRef.current) player.mute();
                resolve(player);
              },
              onStateChange: (e: { data: number }) => {
                if (engineRef.current !== "yt") return;
                if (e.data === 1) {
                  setPlaying(true);
                  setDuration(player.getDuration() || 0);
                } else if (e.data === 2) setPlaying(false);
                else if (e.data === 0) onEnded.current();
              },
              onError: () => {
                // Not embeddable or unavailable: fall back to the preview.
                if (engineRef.current !== "yt") return;
                const t = trackRef.current;
                if (t?.audioUrl) {
                  setError("YouTube wouldn't play this one, so here's the preview.");
                  playRef.current(t, 0);
                } else setError("YouTube wouldn't play this one.");
              },
            },
          });
        }),
    );
    return ytReady.current;
  }, []);

  const currentTime = () => (engineRef.current === "yt" ? yt.current?.getCurrentTime() ?? 0 : audio.current?.currentTime ?? 0);

  // Smooth progress + section looping (preview only).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const a = audio.current;
      if (engineRef.current === "audio" && a) {
        const l = loopRef.current;
        if (l && a.currentTime >= l.end) a.currentTime = l.start;
      }
      setTime(currentTime());
      playedFor.current += (now - last) / 1000;
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
    if (a) {
      a.preservesPitch = keylock;
      a.webkitPreservesPitch = keylock;
      a.playbackRate = rate;
    }
    // YouTube always keeps pitch and may round the speed.
    if (engine === "yt") {
      try {
        yt.current?.setPlaybackRate(rate);
      } catch {}
    }
  }, [rate, keylock, track, engine]);

  const play = useCallback(
    (t: Track, at?: number, queue?: Track[], opts?: PlayOpts) => {
      if (queue) queueRef.current = queue;
      const a = audio.current;
      if (!a) return;
      const seq = ++playSeq.current;
      // Full-length playback for songs, unless jumping to a spot timed on the preview.
      const wantFull = fullRef.current && t.type === "song" && t.source !== "soundcloud" && (at === undefined || !!opts?.full);
      if (!t.audioUrl && !wantFull) {
        a.pause();
        trackRef.current = t;
        setTrack(t);
        setError("This one plays on its source page. Use the link in its details.");
        return;
      }
      setError(null);
      const sameTrack = trackRef.current?.id === t.id;
      trackRef.current = t;
      setTrack(t);
      if (!sameTrack) {
        loopRef.current = null;
        setLoopState(null);
        setTime(0);
        playedFor.current = 0;
      }

      const startAudio = (src: string | undefined, source: FullSource | null) => {
        if (seq !== playSeq.current) return; // a newer play() won
        if (!src) {
          setError("No playable version found.");
          setPlaying(false);
          return;
        }
        try {
          yt.current?.pauseVideo();
        } catch {}
        setEngine("audio");
        if (a.getAttribute("src") !== src) {
          a.src = src;
          setTime(0);
        }
        setFullSource(source);
        if (at !== undefined) {
          const go = () => {
            a.currentTime = at;
          };
          if (a.readyState >= 1) go();
          else a.addEventListener("loadedmetadata", go, { once: true });
        }
        void a.play().catch(() => {});
      };

      const startYt = async (videoId: string) => {
        a.pause();
        setEngine("yt");
        setFullSource({ via: "youtube", url: `https://www.youtube.com/watch?v=${videoId}` });
        const player = await ensureYt();
        if (seq !== playSeq.current) return;
        if (ytVideo.current === videoId) {
          if (at !== undefined) player.seekTo(at, true);
          player.playVideo();
        } else {
          ytVideo.current = videoId;
          setDuration(0);
          player.loadVideoById({ videoId, startSeconds: at ?? 0 });
        }
      };

      if (!wantFull) return startAudio(t.audioUrl, null);
      if (!sameTrack) {
        a.pause();
        try {
          yt.current?.pauseVideo();
        } catch {}
      }
      void (async () => {
        if (ytOn.current) {
          const id = await findVideo(t);
          if (seq !== playSeq.current) return;
          if (id) return startYt(id);
        }
        if (scConnected()) {
          const scTrack = await fullVersion(t);
          if (seq !== playSeq.current) return;
          if (scTrack?.audioUrl) return startAudio(scTrack.audioUrl, { via: "soundcloud", url: scTrack.pageUrl });
        }
        startAudio(t.audioUrl, null);
      })();
    },
    [ensureYt],
  );

  playRef.current = play;
  const pause = useCallback(() => {
    audio.current?.pause();
    try {
      yt.current?.pauseVideo();
    } catch {}
  }, []);

  const toggle = useCallback(
    (t?: Track) => {
      if (t && t.id !== track?.id) return play(t);
      if (!track) return;
      if (engineRef.current === "yt" && yt.current) {
        if (yt.current.getPlayerState() === 1) yt.current.pauseVideo();
        else yt.current.playVideo();
        return;
      }
      const a = audio.current;
      if (!a || !a.getAttribute("src")) return play(track);
      if (a.paused) void a.play().catch(() => {});
      else a.pause();
    },
    [play, track],
  );

  const seek = useCallback((t: number) => {
    const s = Math.max(0, t);
    if (engineRef.current === "yt") yt.current?.seekTo(s, true);
    else if (audio.current) audio.current.currentTime = s;
    setTime(s);
  }, []);

  const setLoop = useCallback((s: Section | null) => {
    loopRef.current = s;
    setLoopState(s);
  }, []);

  const isPlaying = useCallback((id: string) => playing && track?.id === id, [playing, track]);
  const fullAvailable = !!config?.youtube || !!sc?.connected;

  const value = useMemo(
    () => ({ track, playing, time, duration, loop, sync, keylock, rate, error, play, toggle, pause, seek, setLoop, setSync, setKeylock, isPlaying, muted, setMuted, full, setFull, fullSource, fullAvailable }),
    [track, playing, time, duration, loop, sync, keylock, rate, error, play, toggle, pause, seek, setLoop, isPlaying, muted, setMuted, full, setFull, fullSource, fullAvailable],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* YouTube's player must stay visible while it plays, so it lives in a small floating window. */}
      <div
        className={`glass-strong fixed bottom-[5.5rem] right-3 z-40 w-[248px] overflow-hidden rounded-xl border border-white/[0.1] shadow-[0_16px_40px_rgb(0_0_0/0.55)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          engine === "yt" && track ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <div ref={ytHost} className="size-full [&>iframe]:pointer-events-none [&>iframe]:size-full" />
          {/* Covers the video so YouTube's hover title and logo never show; a click pauses or plays. */}
          <button
            onClick={() => toggle()}
            aria-label={playing ? "Pause" : "Play"}
            className="group absolute inset-0 grid place-items-center"
          >
            <span
              className={`grid size-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition-opacity duration-200 ${
                playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
              }`}
            >
              {playing ? (
                <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></svg>
              ) : (
                <svg viewBox="0 0 16 16" className="ml-0.5 size-4" fill="currentColor" aria-hidden><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" /></svg>
              )}
            </span>
          </button>
          {track && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
              <div className="h-full bg-accent" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-mute">
          <span className="truncate">Playing from YouTube</span>
          {fullSource?.via === "youtube" && (
            <a href={fullSource.url} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:text-paper">
              Open ↗
            </a>
          )}
        </div>
      </div>
    </Ctx.Provider>
  );
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
                    <span className="ml-1.5 text-accent">· full via {p.fullSource.via === "youtube" ? "YouTube" : "SoundCloud"}</span>
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
              {p.fullAvailable && (
                <button
                  onClick={() => {
                    p.setFull(!p.full);
                    if (p.track) p.play(p.track);
                  }}
                  className={`btn ${p.full ? "btn-on" : ""}`}
                  title="Play the full song (YouTube or SoundCloud) instead of the 30s preview"
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
