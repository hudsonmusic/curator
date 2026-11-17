"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/lib/types";
import { useAnalysis, useAnalysisVersion, bpmFixOf } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { semitonesFromRate } from "@/lib/keys";
import { Artwork } from "./artwork";
import { Vinyl } from "./vinyl";
import { Waveform } from "./waveform";
import { PauseIcon, PlayIcon, fmt, usePlayer } from "./player";
import { metaOf } from "./meta";
import { Pivot, relatedTo } from "./related";
import { BpmFix } from "./bpm-fix";
import { BpmInput } from "./bpm-input";
import { RadioIcon, useRadio } from "./radio";
import { useSheet } from "./sheet";

/** Full-screen now playing: the record, the controls, and what's playing next. */
export function NowPlaying() {
  const r = useRadio();
  const p = usePlayer();
  const { toggleSave } = useProfile();
  const open = r.open && !!p.track;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Tab" || e.metaKey || e.ctrlKey) return;
      // The list underneath doesn't get keys while this is open.
      e.stopImmediatePropagation();
      if (e.key === "Escape") r.setOpen(false);
      else if (e.key === " ") {
        e.preventDefault();
        p.toggle();
      } else if (e.key === "ArrowRight") p.next();
      else if (e.key === "ArrowLeft") p.prev();
      else if (e.key === "s" && p.track) toggleSave(p.track);
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Moves the YouTube mini window out of the way (see globals.css).
    document.documentElement.dataset.np = "1";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.np;
    };
  }, [open, r, p, toggleSave]);

  return (
    <AnimatePresence>
      {open && p.track && (
        <motion.div
          key="now-playing"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="fixed inset-0 z-[52] overflow-y-auto overscroll-contain bg-ink"
          role="dialog"
          aria-label="Now playing"
        >
          <Backdrop track={p.track} />
          <Body track={p.track} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Backdrop({ track }: { track: Track }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {track.artwork && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={track.artwork} src={track.artwork} alt="" className="fade-up absolute inset-0 size-full scale-150 object-cover opacity-45 blur-3xl saturate-150" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(80rem_50rem_at_50%_0%,color-mix(in_srgb,var(--color-accent)_22%,transparent),transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/70 to-ink" />
    </div>
  );
}

function Body({ track }: { track: Track }) {
  const r = useRadio();
  const p = usePlayer();
  const sheet = useSheet();
  const { profile, saved, toggleSave } = useProfile();
  useAnalysisVersion();
  const entry = useAnalysis(track);
  const a = entry?.data;
  const m = metaOf(track);
  const [fixing, setFixing] = useState(false);
  const simple = profile.viewMode === "simple";
  const preview = !p.fullSource;
  const isSaved = !!saved[track.id];
  const shift = p.keylock ? 0 : semitonesFromRate(p.rate);
  const next = r.on ? r.upcoming : p.upNext(25);

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-10 sm:px-6">
      <div className="flex h-14 items-center justify-between">
        <button
          onClick={() => r.setOpen(false)}
          aria-label="Close"
          title="Close (esc)"
          className="grid size-9 place-items-center rounded-full text-paper/80 transition-colors hover:bg-white/[0.1] hover:text-paper"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3.5 6l4.5 4.5L12.5 6" />
          </svg>
        </button>
        <span className="label">{r.on ? "Dig radio" : "Now playing"}</span>
        <button
          onClick={() => (r.on ? r.stop() : r.start(track))}
          className={`btn rounded-full px-3 ${r.on ? "btn-on" : ""}`}
          title={r.on ? "Stop the radio (the song keeps playing)" : "Keep playing songs related to this one"}
        >
          <RadioIcon className="size-3.5" />
          {r.on ? "Radio on" : "Start radio"}
        </button>
      </div>

      <div className="grid flex-1 items-start gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 lg:pt-8">
        <div className="flex min-w-0 flex-col items-center">
          {/* The sleeve, with the record sliding out of it while it plays. */}
          <div className="np-stage relative transition-[margin] [--s:min(58vw,330px)]" style={{ width: "calc(var(--s) * 1.42)", height: "var(--s)" }}>
            <div
              className="absolute top-[3%] h-[94%] transition-[left] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ left: p.playing ? "calc(var(--s) * 0.45)" : "calc(var(--s) * 0.2)" }}
            >
              <Vinyl track={track} spinning={p.playing} label={0.4} className="h-full" />
            </div>
            <button
              onClick={() => sheet.open(track)}
              title="Details"
              className="absolute inset-y-0 left-0 aspect-square overflow-hidden rounded-md shadow-[0_24px_60px_rgb(0_0_0/0.6)] ring-1 ring-white/10"
            >
              <Artwork track={track} big />
            </button>
          </div>

          <div className="mt-8 w-full max-w-xl text-center">
            <h2 className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{track.title}</h2>
            <div className="mt-1.5 flex justify-center text-[15px] text-paper/70">
              <Pivot by="artist" value={track.artist} track={track} onDone={() => r.setOpen(false)}>
                {track.artist}
              </Pivot>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[12px]">
              {track.label && (
                <Chip>
                  <Pivot by="label" value={track.label} track={track} onDone={() => r.setOpen(false)}>
                    {track.label}
                  </Pivot>
                </Chip>
              )}
              {track.year && (
                <Chip>
                  <Pivot by="year" value={track.year} track={track} onDone={() => r.setOpen(false)}>
                    {track.year}
                  </Pivot>
                </Chip>
              )}
              {m.genre && (
                <Chip>
                  <Pivot by="genre" value={m.genre} track={track} onDone={() => r.setOpen(false)}>
                    {m.genre}
                  </Pivot>
                </Chip>
              )}
              <button
                onClick={() => setFixing((f) => !f)}
                title="Fix the BPM"
                className={`rounded-full px-2.5 py-1 font-mono transition-colors ${fixing ? "bg-accent text-onaccent" : "bg-white/[0.08] hover:bg-white/[0.14]"}`}
              >
                {m.bpm ? `${Math.round(m.bpm)} BPM` : "BPM ?"}
                {bpmFixOf(track.id) !== undefined && " ✓"}
              </button>
              {m.cam && (
                <Chip>
                  <span className="font-mono">
                    {m.cam}
                    {!simple && m.key ? ` · ${m.key}` : ""}
                  </span>
                </Chip>
              )}
              {p.fullSource ? (
                <span className="text-accent">full via {p.fullSource.via === "youtube" ? "YouTube" : "SoundCloud"}</span>
              ) : track.previewOnly ? (
                <span className="text-mute">preview</span>
              ) : null}
            </div>
            {fixing && (
              <div className="mx-auto mt-3 max-w-sm text-left">
                <BpmFix track={track} onClose={() => setFixing(false)} />
              </div>
            )}
          </div>

          <div className="mt-6 flex w-full max-w-xl items-center gap-3">
            <span className="w-10 text-right font-mono text-[11px] text-mute">{fmt(p.time)}</span>
            <div className="h-12 flex-1">
              <Waveform
                peaks={preview ? a?.peaks : undefined}
                seed={track.id}
                progress={p.duration ? p.time / p.duration : 0}
                sections={preview && !simple ? a?.sections : undefined}
                duration={preview ? (a?.duration ?? p.duration) : p.duration}
                loop={p.loop}
                onSeek={(f) => p.seek(f * (p.duration || 0))}
                compact
              />
            </div>
            <span className="w-10 font-mono text-[11px] text-mute">{fmt(p.duration)}</span>
          </div>

          <div className="mt-5 flex items-center gap-6">
            <Round onClick={p.prev} label="Previous">
              <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
                <rect x="2.5" y="3" width="2" height="10" rx="0.6" />
                <path d="M14 3v10L5.5 8z" />
              </svg>
            </Round>
            <button
              onClick={() => p.toggle()}
              aria-label={p.playing ? "Pause" : "Play"}
              className="grid size-16 place-items-center rounded-full bg-paper text-ink shadow-[0_10px_30px_rgb(0_0_0/0.5)] transition-transform duration-150 hover:scale-105 active:scale-90"
            >
              {p.playing ? <PauseIcon className="size-6" /> : <PlayIcon className="size-6 translate-x-[1px]" />}
            </button>
            <Round onClick={p.next} label="Next">
              <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
                <rect x="11.5" y="3" width="2" height="10" rx="0.6" />
                <path d="M2 3v10l8.5-5z" />
              </svg>
            </Round>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[12px]">
            <button onClick={() => toggleSave(track)} className={`btn rounded-full px-3 ${isSaved ? "btn-on" : ""}`}>
              <svg viewBox="0 0 24 24" className={`size-3.5 ${isSaved ? "fill-current" : "fill-none"} stroke-current`} strokeWidth="2" aria-hidden>
                <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
              </svg>
              {isSaved ? "Saved" : "Save"}
            </button>
            {track.type === "song" && (
              <button
                onClick={() => {
                  relatedTo(track);
                  r.setOpen(false);
                }}
                className="btn rounded-full px-3"
                title="Find songs like this one"
              >
                Similar songs
              </button>
            )}
            {p.fullAvailable && (
              <button
                onClick={() => {
                  p.setFull(!p.full);
                  p.play(track);
                }}
                className={`btn rounded-full px-3 ${p.full ? "btn-on" : ""}`}
                title="Play the full song instead of the 30s preview"
              >
                Full
              </button>
            )}
            {!simple && (
              <>
                <button onClick={() => p.setSync(!p.sync)} className={`btn rounded-full px-3 ${p.sync ? "btn-on" : ""}`} title="Varispeed to your project tempo">
                  Sync
                </button>
                <BpmInput className="w-14 rounded-full text-center" />
                <button onClick={() => p.setKeylock(!p.keylock)} className={`btn rounded-full px-3 ${p.keylock ? "btn-on" : ""}`} title="Change tempo without changing pitch">
                  Key lock
                </button>
                {p.sync && Math.abs(shift) >= 0.05 && (
                  <span className="font-mono text-[11px] text-mute">
                    {shift > 0 ? "+" : ""}
                    {shift.toFixed(1)} st
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <section className="glass min-w-0 rounded-2xl border border-white/[0.08] p-3 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-15rem)] lg:overflow-y-auto">
          <div className="flex items-baseline justify-between px-2 pb-2 pt-1">
            <h3 className="text-[14px] font-semibold tracking-tight">Playing next</h3>
            <span className="truncate pl-3 text-[11px] text-mute">
              {r.on ? (r.loading ? "digging…" : `Radio · dug from songs like “${track.title}”`) : next.length ? "From your list" : ""}
            </span>
          </div>
          {next.length ? (
            <ol className="space-y-px">
              <AnimatePresence initial={false}>
                {next.map((t, i) => (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ type: "spring", stiffness: 500, damping: 40, delay: Math.min(i, 10) * 0.02 }}
                  >
                    <UpNextRow track={t} onPlay={() => (r.on ? r.jump(t) : p.play(t))} onRemove={r.on ? () => r.remove(t.id) : undefined} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          ) : r.loading ? (
            <div className="space-y-1 px-1">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.05]" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : (
            <div className="px-2 pb-3 pt-2 text-[13px] text-mute">
              <p>Nothing lined up.</p>
              <button onClick={() => r.start(track)} className="btn btn-on mt-3 rounded-full px-3">
                <RadioIcon className="size-3.5" />
                Start dig radio from this song
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function UpNextRow({ track, onPlay, onRemove }: { track: Track; onPlay: () => void; onRemove?: () => void }) {
  const m = metaOf(track);
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.06]">
      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Play now">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-md shadow-[0_2px_6px_rgb(0_0_0/0.4)]">
          <Artwork track={track} />
          <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <PlayIcon className="size-3.5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{track.title}</div>
          <div className="flex min-w-0 items-center gap-1 truncate text-[12px] text-mute">
            <span className="truncate">{track.artist}</span>
            {track.year && <span className="shrink-0">· {track.year}</span>}
            {track.deep && <span className="shrink-0 rounded bg-white/[0.08] px-1 text-[10px] leading-4 text-paper/70">deep cut</span>}
          </div>
        </div>
        {m.bpm && <span className="shrink-0 font-mono text-[11px] text-mute">{Math.round(m.bpm)}</span>}
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${track.title}`}
          title="Skip this one"
          className="grid size-6 shrink-0 place-items-center rounded-md text-mute opacity-100 transition-opacity hover:bg-white/[0.1] hover:text-paper sm:opacity-0 sm:group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="max-w-[16rem] truncate rounded-full bg-white/[0.08] px-2.5 py-1">{children}</span>;
}

function Round({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-full text-paper/85 transition-[background-color,transform] hover:bg-white/[0.1] hover:text-paper active:scale-90"
    >
      {children}
    </button>
  );
}
