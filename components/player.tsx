"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Section, Track } from "@/lib/types";
import { bpmOf, useAnalysis } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { semitonesFromRate, shiftKey, syncRate } from "@/lib/keys";
import { Waveform } from "./waveform";
import { useSheet } from "./sheet";
import { fullVersion, scConnected, useScStatus } from "@/lib/soundcloud-client";
import { useConfig } from "@/lib/config";
import { findVideo, loadYouTubeApi, type YTPlayer } from "./youtube";
import { BpmInput } from "./bpm-input";
import { Vinyl } from "./vinyl";
import { RadioIcon, useRadio } from "./radio";

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
  /** Whether a track can play here: it has audio, or it's a song we can find in full. */
  canPlay: (t: Track) => boolean;
  /** Skip to the next playable song in the queue (or ask for a new one). */
  next: () => void;
  /** Back to the start, or to the previous song if you're near the start. */
  prev: () => void;
  /** Replace what plays after the current song. */
  setQueue: (q: Track[]) => void;
  /** The playable songs after this one in the current list. */
  upNext: (n?: number) => Track[];
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
  // YouTube overlays its title and logo while loading, paused, or just started, so the
  // mini window shows cover art until the video has played cleanly for a few seconds.
  const [videoClear, setVideoClear] = useState(false);
  // Minimized YouTube window (remembered).
  const [ytMin, setYtMinState] = useState(false);
  const setYtMin = useCallback((m: boolean) => {
    setYtMinState(m);
    try {
      localStorage.setItem("curator:yt-min", m ? "1" : "0");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      setYtMinState(localStorage.getItem("curator:yt-min") === "1");
    } catch {}
  }, []);
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
  const seekRef = useRef<(t: number) => void>(() => {});
  const playRef = useRef<(t: Track, at?: number, queue?: Track[], opts?: PlayOpts) => void>(() => {});
  const playedFor = useRef(0);
  // What the audio element is playing: the track's own audio URL (before resolving),
  // plus the hls.js instance when that's a SoundCloud HLS stream.
  const srcRef = useRef<string | null>(null);
  const srcSource = useRef<FullSource | null>(null);
  const hlsRef = useRef<{ destroy(): void } | null>(null);
  const { profile, signal, addHistory, history } = useProfile();
  const historyRef = useRef(history);
  historyRef.current = history;
  const entry = useAnalysis(track, "priority");
  const bpm = track ? bpmOf(track, entry) : undefined;
  const rate = sync && bpm ? syncRate(bpm, profile.projectBpm) : 1;

  // Auto-advance: next playable track in the queue, or a new random pick.
  const canPlayRef = useRef<(t: Track) => boolean>((t) => !!t.audioUrl);
  const onEnded = useRef(() => {});
  onEnded.current = () => {
    setPlaying(false);
    const q = queueRef.current;
    const i = q.findIndex((x) => x.id === trackRef.current?.id);
    const next = i >= 0 ? q.slice(i + 1).find((x) => canPlayRef.current(x)) : undefined;
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
      if (engineRef.current !== "audio" || !srcRef.current) return;
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
                  // Your YouTube caption setting would show subtitles over the video; turn them off.
                  try {
                    player.unloadModule?.("captions");
                  } catch {}
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

  // Lets the full-screen view make room for the YouTube window.
  useEffect(() => {
    if (engine === "yt" && track) document.documentElement.dataset.yt = "1";
    else delete document.documentElement.dataset.yt;
  }, [engine, track]);

  useEffect(() => {
    setVideoClear(false);
    if (engine !== "yt" || !playing) return;
    const id = setTimeout(() => setVideoClear(true), 4000);
    return () => clearTimeout(id);
  }, [engine, playing, track?.id]);

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

  // Play history: anything you listened to for a few seconds.
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (!playing || !track || logged.current === track.id) return;
    const id = setTimeout(() => {
      logged.current = track.id;
      addHistory(track);
    }, 4000);
    return () => clearTimeout(id);
  }, [playing, track, addHistory]);

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
      if (!t.audioUrl && !wantFull && !t.youtubeId) {
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

      const startAudio = async (src: string | undefined, source: FullSource | null) => {
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
        if (srcRef.current !== src) {
          a.pause();
          hlsRef.current?.destroy();
          hlsRef.current = null;
          srcRef.current = src;
          setTime(0);
          let url = src;
          let hls = false;
          // SoundCloud streams need resolving with the user's sign-in; full tracks come as HLS.
          if (src.startsWith("/api/soundcloud/stream/")) {
            const r = await fetch(`${src}?resolve=1`)
              .then((res) => (res.ok ? (res.json() as Promise<{ url: string; hls: boolean; preview: boolean }>) : null))
              .catch(() => null);
            if (seq !== playSeq.current) return;
            if (!r) {
              srcRef.current = null;
              setError("SoundCloud wouldn't stream this one.");
              setPlaying(false);
              return;
            }
            ({ url, hls } = r);
            source = r.preview ? null : (source ?? { via: "soundcloud", url: trackRef.current?.pageUrl ?? "" });
          }
          srcSource.current = source;
          // hls.js wherever it works; built-in HLS only as a fallback (iPhone Safari).
          // Chrome now answers "maybe" for HLS but its built-in support is unreliable.
          const Hls = hls ? (await import("hls.js")).default : null;
          if (seq !== playSeq.current) return;
          if (Hls?.isSupported()) {
            const h = new Hls();
            h.on(Hls.Events.ERROR, (_e, d) => {
              if (!d.fatal || seq !== playSeq.current) return;
              setPlaying(false);
              setError("SoundCloud's stream stopped. Try playing it again.");
            });
            h.loadSource(url);
            h.attachMedia(a);
            hlsRef.current = h;
          } else a.src = url;
        } else source = srcSource.current ?? source;
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

      // A link you opened plays that exact video, whatever the Full setting is.
      if (t.youtubeId) return void startYt(t.youtubeId);
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

  const next = useCallback(() => onEnded.current(), []);
  const prev = useCallback(() => {
    if (currentTime() > 4) return seekRef.current(0);
    const q = queueRef.current;
    const i = q.findIndex((x) => x.id === trackRef.current?.id);
    const before = i > 0 ? q.slice(0, i).reverse().find((x) => canPlayRef.current(x)) : undefined;
    if (before) return playRef.current(before, undefined, q);
    // Not in a list: go back through what you've played.
    const h = historyRef.current.find((x) => x.track.id !== trackRef.current?.id);
    if (h) playRef.current(h.track, undefined, [h.track, ...(trackRef.current ? [trackRef.current] : []), ...q.slice(Math.max(0, i + 1))]);
    else seekRef.current(0);
  }, []);
  const setQueue = useCallback((q: Track[]) => {
    queueRef.current = q;
  }, []);
  const upNext = useCallback((n = 20) => {
    const q = queueRef.current;
    const i = q.findIndex((x) => x.id === trackRef.current?.id);
    return q.slice(i + 1).filter((x) => canPlayRef.current(x)).slice(0, n);
  }, []);
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
  seekRef.current = seek;

  const setLoop = useCallback((s: Section | null) => {
    loopRef.current = s;
    setLoopState(s);
  }, []);

  const isPlaying = useCallback((id: string) => playing && track?.id === id, [playing, track]);
  const fullAvailable = !!config?.youtube || !!sc?.connected;
  const canPlay = useCallback(
    (t: Track) => !!t.audioUrl || !!t.youtubeId || (full && fullAvailable && t.type === "song" && (t.source === "itunes" || t.source === "musicbrainz")),
    [full, fullAvailable],
  );
  canPlayRef.current = canPlay;

  const value = useMemo(
    () => ({ track, playing, time, duration, loop, sync, keylock, rate, error, play, toggle, pause, seek, setLoop, setSync, setKeylock, isPlaying, muted, setMuted, full, setFull, fullSource, fullAvailable, canPlay, next, prev, setQueue, upNext }),
    [track, playing, time, duration, loop, sync, keylock, rate, error, play, toggle, pause, seek, setLoop, isPlaying, muted, setMuted, full, setFull, fullSource, fullAvailable, canPlay, next, prev, setQueue, upNext],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* YouTube's player must stay visible while it plays, so it lives in a small floating window. */}
      <div
        className={`yt-mini glass-strong fixed bottom-[5.5rem] right-3 z-[55] overflow-hidden border border-white/[0.1] shadow-[0_16px_40px_rgb(0_0_0/0.55)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          ytMin ? "yt-min flex w-[208px] items-center gap-2 rounded-full p-1 pr-1.5" : "w-[132px] rounded-xl sm:w-[248px]"
        } ${engine === "yt" && track ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
      >
        {/* Minimized, the video shrinks to a thumbnail but keeps playing (it never unloads). */}
        <div className={`group/yt relative aspect-video shrink-0 overflow-hidden bg-black ${ytMin ? "w-14 rounded-full" : "w-full"}`}>
          <div ref={ytHost} className="size-full [&>iframe]:pointer-events-none [&>iframe]:size-full" />
          {/* No controls here (the player bar has them). Cover art hides YouTube's own overlays. */}
          <div
            aria-hidden
            className={`absolute inset-0 bg-black transition-opacity duration-500 ${videoClear && !ytMin ? "opacity-0" : "opacity-100"}`}
          >
            {track?.artwork && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={track.artwork} alt="" className="absolute inset-0 size-full scale-125 object-cover opacity-50 blur-xl" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={track.artwork} alt="" className={`absolute left-1/2 aspect-square -translate-x-1/2 object-cover shadow-lg ${ytMin ? "inset-y-0 h-full" : "inset-y-3 h-[calc(100%-1.5rem)] rounded-md"}`} />
              </>
            )}
          </div>
          {track && !ytMin && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
              <div className="h-full bg-accent" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
            </div>
          )}
          {!ytMin && (
            <button
              onClick={() => setYtMin(true)}
              aria-label="Minimize video"
              title="Minimize (keeps playing)"
              className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white/90 opacity-100 backdrop-blur transition-opacity hover:bg-black/80 sm:opacity-0 sm:group-hover/yt:opacity-100"
            >
              <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M3.5 8h9" />
              </svg>
            </button>
          )}
        </div>
        {ytMin ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[11px] text-mute">{playing ? "Playing from YouTube" : "YouTube"}</span>
            <button
              onClick={() => setYtMin(false)}
              aria-label="Show video"
              title="Show the video"
              className="grid size-7 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.1] hover:text-paper"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9" />
              </svg>
            </button>
          </>
        ) : (
          <div className="hidden items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] text-mute sm:flex">
            <span className="truncate">Playing from YouTube</span>
            <span className="flex shrink-0 items-center gap-2.5">
              {fullSource?.via === "youtube" && (
                <a href={fullSource.url} target="_blank" rel="noopener noreferrer" className="hover:text-paper">
                  Open ↗
                </a>
              )}
              <button onClick={() => setYtMin(true)} className="hover:text-paper" title="Minimize (keeps playing)">
                Minimize
              </button>
            </span>
          </div>
        )}
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
  const sheet = useSheet();
  const radio = useRadio();
  const { profile } = useProfile();
  const simple = profile.viewMode === "simple";
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
          <div className="glass-strong mx-auto flex h-16 max-w-6xl items-center gap-2.5 rounded-2xl border border-white/[0.1] px-2.5 shadow-[0_20px_50px_rgb(0_0_0/0.55)] sm:gap-4 sm:px-3">
            <button
              onClick={() => {
                if (!p.track) return;
                // On a phone the bar is small, so tapping it opens the big view.
                if (window.matchMedia("(max-width: 767px)").matches) radio.setOpen(true);
                else sheet.open(p.track);
              }}
              className="flex min-w-0 flex-1 items-center gap-3 text-left md:w-60 md:flex-none"
            >
              <Vinyl track={p.track} spinning={p.playing} label={0.62} className="size-11 shrink-0" />
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

            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={p.prev}
                aria-label="Previous"
                title="Previous"
                className="hidden size-8 place-items-center rounded-full text-paper/80 transition-colors hover:bg-white/[0.1] hover:text-paper sm:grid"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
                  <rect x="2.5" y="3" width="2" height="10" rx="0.6" />
                  <path d="M14 3v10L5.5 8z" />
                </svg>
              </button>
              <button
                onClick={() => p.toggle()}
                aria-label={p.playing ? "Pause" : "Play"}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-ink shadow-[0_2px_8px_rgb(0_0_0/0.4)] transition-transform duration-150 hover:scale-105 active:scale-90"
              >
                {p.playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button
                onClick={p.next}
                aria-label="Next"
                title={radio.on ? "Next on the radio" : "Next"}
                className="grid size-8 place-items-center rounded-full text-paper/80 transition-colors hover:bg-white/[0.1] hover:text-paper"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
                  <rect x="11.5" y="3" width="2" height="10" rx="0.6" />
                  <path d="M2 3v10l8.5-5z" />
                </svg>
              </button>
            </div>

            <div className="hidden min-w-[140px] flex-1 items-center gap-2.5 md:flex">
              <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-mute">{fmt(p.time)}</span>
              <div className="h-10 min-w-0 flex-1">
                <Waveform
                  peaks={preview ? a?.peaks : undefined}
                  seed={p.track.id}
                  progress={p.duration ? p.time / p.duration : 0}
                  sections={preview && !simple ? a?.sections : undefined}
                  duration={preview ? (a?.duration ?? p.duration) : p.duration}
                  loop={p.loop}
                  onSeek={(f) => p.seek(f * (p.duration || 0))}
                  compact
                />
              </div>
              <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-mute">{fmt(p.duration)}</span>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-[12px]">
              {p.fullAvailable && (
                <button
                  onClick={() => {
                    p.setFull(!p.full);
                    if (p.track) p.play(p.track);
                  }}
                  className={`btn hidden sm:inline-flex ${p.full ? "btn-on" : ""}`}
                  title="Play the full song (YouTube or SoundCloud) instead of the 30s preview"
                >
                  Full
                </button>
              )}
              <button
                onClick={() => p.setMuted(!p.muted)}
                className={`btn hidden px-2 sm:inline-flex ${p.muted ? "btn-on" : ""}`}
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
                <button onClick={() => p.setLoop(null)} className="btn btn-on hidden sm:inline-flex">
                  Loop ×
                </button>
              )}
              {!simple && (
                <>
                  <button
                    onClick={() => p.setSync(!p.sync)}
                    className={`btn hidden lg:inline-flex ${p.sync ? "btn-on" : ""}`}
                    title="Varispeed the song to your project tempo"
                  >
                    Sync
                  </button>
                  <BpmInput className="hidden w-12 text-center lg:block" />
                  <button
                    onClick={() => p.setKeylock(!p.keylock)}
                    className={`btn hidden xl:inline-flex ${p.keylock ? "btn-on" : ""}`}
                    title="Key lock: change tempo without changing pitch"
                  >
                    Key lock
                  </button>
                  <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-mute 2xl:block">
                    {p.sync && Math.abs(shift) >= 0.05 ? `${shift > 0 ? "+" : ""}${shift.toFixed(1)} st` : ""}
                    {shownKey ? ` · ${shownKey}` : ""}
                  </span>
                </>
              )}
              <button
                onClick={() => radio.setOpen(true)}
                aria-label="Open now playing"
                title={radio.on ? "Radio and what's playing next" : "Now playing and what's next"}
                className={`grid size-8 place-items-center rounded-lg transition-colors hover:bg-white/[0.1] hover:text-paper ${radio.on ? "text-accent" : "text-mute"}`}
              >
                {radio.on ? (
                  <RadioIcon className="size-4" />
                ) : (
                  <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9" />
                  </svg>
                )}
              </button>
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
