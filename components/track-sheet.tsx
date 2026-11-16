"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/lib/types";
import { useAnalysis } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { useConfig } from "@/lib/config";
import { semitonesFromRate, shiftKey, syncRate } from "@/lib/keys";
import { Artwork } from "./artwork";
import { Waveform } from "./waveform";
import { PauseIcon, PlayIcon, fmt, usePlayer } from "./player";
import { useSheet } from "./sheet";
import { TYPE_LABEL, useTrackMeta } from "./meta";
import { YouTube, type YTHandle } from "./youtube";

const SOURCE_NAME = { itunes: "Apple Music", ccmixter: "ccMixter", freesound: "Freesound", soundcloud: "SoundCloud" } as const;

export function TrackSheet() {
  const { track, close } = useSheet();

  useEffect(() => {
    if (!track) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [track, close]);

  return (
    <AnimatePresence>
      {track && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/30"
          />
          <motion.aside
            key="sheet"
            initial={{ x: 40, opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="glass-strong fixed bottom-2 right-2 top-2 z-50 w-[calc(100%-1rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.1] pb-28 shadow-[0_30px_80px_rgb(0_0_0/0.6)]"
          >
            <SheetBody key={track.id} track={track} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetBody({ track }: { track: Track }) {
  const { close, open } = useSheet();
  const p = usePlayer();
  const config = useConfig();
  const { profile, saved, markers, toggleSave, setNote, addMarker, removeMarker, signal } = useProfile();
  const entry = useAnalysis(track, track.audioUrl ? "priority" : false);
  const { bpm, key, cam } = useTrackMeta(track);
  const a = entry?.data;
  const isCur = p.track?.id === track.id;
  const playing = p.isPlaying(track.id);
  const isSaved = !!saved[track.id];
  const marks = markers[track.id] ?? [];
  const yt = useRef<YTHandle | null>(null);
  const [ytMissing, setYtMissing] = useState(false);
  const [more, setMore] = useState<Track[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const dur = a?.duration || (isCur ? p.duration : 0) || 30;
  const query = `${track.artist} ${track.title}`;
  const isSong = track.type === "song";

  const syncedRate = bpm ? syncRate(bpm, profile.projectBpm) : 1;
  const syncShift = semitonesFromRate(syncedRate);

  const mark = () => {
    const ytTime = yt.current?.time();
    if (ytTime != null) {
      addMarker(track.id, { t: Math.round(ytTime * 10) / 10, src: "youtube" });
      signal("mark", track);
      setFlash(`Marked ${fmt(ytTime)} on YouTube`);
    } else if (isCur) {
      addMarker(track.id, { t: Math.round(p.time * 10) / 10, src: "preview" });
      signal("mark", track);
      setFlash(`Marked ${fmt(p.time)} on the preview`);
    } else {
      setFlash("Play the preview or the video first");
    }
    setTimeout(() => setFlash(null), 1800);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "m") mark();
      if (e.key === " ") {
        e.preventDefault();
        if (track.audioUrl) p.toggle(track);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Opening a track plays it.
  useEffect(() => {
    if (track.audioUrl && p.track?.id !== track.id) p.play(track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch("/api/more", { method: "POST", body: JSON.stringify({ track }) });
      setMore(((await res.json()) as { tracks: Track[] }).tracks);
    } finally {
      setLoadingMore(false);
    }
  };

  const stats: [string, string | undefined, boolean?][] = [
    ["BPM", bpm ? String(Math.round(bpm)) : entry?.status === "loading" || entry?.status === "queued" ? "···" : "—"],
    ["Key", key ?? (entry?.status === "loading" ? "···" : "—")],
    ["Camelot", cam ?? "—"],
    ["Year", track.year ? String(track.year) : "—"],
    ["Genre", track.genre ?? "—"],
    ["Length", track.durationSec ? fmt(track.durationSec) : "—"],
  ];

  return (
    <div className="px-6 pt-5 sm:px-8">
      <div className="flex items-center justify-between label">
        <span>
          {TYPE_LABEL[track.type]} · {SOURCE_NAME[track.source]}
        </span>
        <button onClick={close} className="rounded-full border border-line px-3 py-1 transition-colors hover:text-paper">
          esc
        </button>
      </div>

      <div className="mt-5 flex gap-4">
        <div className="size-28 shrink-0 overflow-hidden rounded-xl shadow-[0_10px_30px_rgb(0_0_0/0.5)]">
          <Artwork track={track} big />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex min-w-0 flex-col justify-end"
        >
          <h2 className="text-2xl font-semibold leading-tight">{track.title}</h2>
          <p className="mt-1.5 text-mute">{track.artist}</p>
          <div className="mt-4 flex items-center gap-2">
            {track.audioUrl ? (
              <button
                onClick={() => p.toggle(track)}
                className="flex items-center gap-2 rounded-full bg-paper py-1.5 pl-3 pr-3.5 text-[13px] font-medium text-ink shadow-[0_2px_8px_rgb(0_0_0/0.4)] transition-transform duration-150 hover:scale-[1.03] active:scale-95"
              >
                {playing ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
                {track.previewOnly ? "Preview" : "Play"}
              </button>
            ) : (
              <a
                href={track.pageUrl}
                target="_blank"
                rel="noopener"
                className="rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink transition-transform hover:scale-[1.03]"
              >
                Listen on {SOURCE_NAME[track.source]} ↗
              </a>
            )}
            <button
              onClick={() => toggleSave(track)}
              className={`btn rounded-full px-3.5 py-1.5 ${isSaved ? "btn-on" : ""}`}
            >
              {isSaved ? "Saved" : "Save"}
            </button>
            <button
              onClick={() => {
                signal("pass", track);
                close();
              }}
              className="rounded-full px-2 py-1.5 text-[13px] text-mute transition-colors hover:text-paper"
            >
              Not for me
            </button>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.03, delayChildren: 0.15 } } }}
        className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-white/[0.03]"
      >
        {stats.map(([label, value, hi]) => (
          <motion.div
            key={label}
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
            className="border-b border-r border-line p-3 [&:nth-child(3n)]:border-r-0 [&:nth-last-child(-n+3)]:border-b-0"
          >
            <div className="label">{label}</div>
            <div className={`mt-1 truncate font-mono text-lg ${hi ? "text-accent" : ""}`}>{value}</div>
          </motion.div>
        ))}
      </motion.div>
      {isSong && <AddToCrate artist={track.artist} />}

      {track.audioUrl && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h3 className="label">
              {track.previewOnly ? "30s preview" : "Waveform"}
            </h3>
            <span className="font-mono text-[11px] text-mute">
              {isCur ? fmt(p.time) : "0:00"} / {fmt(dur)}
            </span>
          </div>
          <div className="mt-3 h-24">
            <Waveform
              peaks={a?.peaks}
              seed={track.id}
              loading={entry?.status !== "done"}
              progress={isCur && p.duration ? p.time / p.duration : 0}
              duration={dur}
              sections={a?.sections}
              markers={marks.filter((m) => m.src === "preview")}
              loop={isCur ? p.loop : null}
              onSeek={(f) => (isCur ? p.seek(f * (p.duration || dur)) : p.play(track, f * dur))}
            />
          </div>
          {bpm && (
            <p className="mt-3 font-mono text-[11px] text-mute">
              At your {profile.projectBpm} BPM: ×{syncedRate.toFixed(3)}
              {Math.abs(syncShift) >= 0.05 && ` · ${syncShift > 0 ? "+" : ""}${syncShift.toFixed(1)} semitones`}
              {key && Math.abs(syncShift) >= 0.5 && ` → ${shiftKey(key, syncShift)}`}
              <button
                onClick={() => {
                  p.setSync(true);
                  if (!playing) p.play(track);
                }}
                className="ml-2 text-accent underline-offset-2 hover:underline"
              >
                hear it
              </button>
            </p>
          )}

          {!!a?.sections.length && (
            <div className="mt-6">
              <h3 className="label">Loop-friendly sections</h3>
              <p className="mt-1 text-xs text-mute">Melodic, light on drums, cut to whole bars. Click one to loop it.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.sections.map((s) => {
                  const active = isCur && p.loop?.start === s.start;
                  return (
                    <button
                      key={s.start}
                      onClick={() => {
                        if (active) return p.setLoop(null);
                        p.play(track, s.start);
                        p.setLoop(s);
                      }}
                      className={`group/s relative overflow-hidden rounded-lg border px-3 py-2 text-left font-mono text-xs transition-colors ${
                        active ? "border-accent text-accent" : "border-line hover:border-paper"
                      }`}
                    >
                      <span className="relative">
                        {fmt(s.start)}–{fmt(s.end)}
                      </span>
                      <span className="absolute bottom-0 left-0 h-0.5 bg-accent/70" style={{ width: `${Math.max(8, s.score * 100)}%` }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="label">Chop points</h3>
          <button onClick={mark} className="btn">
            + mark <span className="text-mute">(m)</span>
          </button>
        </div>
        <AnimatePresence>
          {flash && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 font-mono text-[11px] text-accent">
              {flash}
            </motion.p>
          )}
        </AnimatePresence>
        {marks.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {marks.map((m) => (
              <span key={`${m.src}${m.t}`} className="flex items-center overflow-hidden rounded-lg border border-line font-mono text-xs">
                <button
                  onClick={() => (m.src === "youtube" ? yt.current?.seek(m.t) : p.play(track, m.t))}
                  className="px-3 py-1.5 transition-colors hover:bg-panel"
                >
                  {fmt(m.t)} <span className="text-mute">{m.src === "youtube" ? "yt" : "pv"}</span>
                </button>
                <button onClick={() => removeMarker(track.id, m.t)} className="border-l border-line px-2 py-1.5 text-mute hover:text-paper">
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-mute">
            Press M while the {isSong ? "video or preview" : "audio"} plays to drop a marker. Markers also teach curator what you like.
          </p>
        )}
      </section>

      {isSong && (
        <section className="mt-8">
          <h3 className="mb-3 label">Full track</h3>
          {config?.youtube && !ytMissing ? (
            <YouTube query={query} handle={yt} onPlay={() => p.pause()} onMissing={() => setYtMissing(true)} />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <ExtLink href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}>YouTube</ExtLink>
            <ExtLink href={`https://soundcloud.com/search?q=${encodeURIComponent(query)}`}>SoundCloud</ExtLink>
            <ExtLink href={`https://www.discogs.com/search/?q=${encodeURIComponent(query)}&type=all`}>Discogs</ExtLink>
            <ExtLink href={`https://www.whosampled.com/search/?q=${encodeURIComponent(query)}`}>WhoSampled</ExtLink>
            {track.pageUrl && <ExtLink href={track.pageUrl}>{SOURCE_NAME[track.source]}</ExtLink>}
          </div>
        </section>
      )}
      {!isSong && (
        <section className="mt-8 flex flex-wrap gap-2 text-sm">
          <ExtLink href={track.pageUrl}>
            {track.source === "ccmixter" ? "Listen & download on ccMixter" : `Open on ${SOURCE_NAME[track.source]}`}
          </ExtLink>
          {track.tags.map((t) => (
            <span key={t} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-mute">
              {t.replace(/_/g, " ")}
            </span>
          ))}
        </section>
      )}

      <section className="mt-8">
        <h3 className="mb-2 label">Notes</h3>
        {isSaved ? (
          <textarea
            defaultValue={saved[track.id]?.note ?? ""}
            onChange={(e) => setNote(track.id, e.target.value)}
            placeholder="Rhodes at 1:42, pitch down 2st…"
            rows={3}
            className="field w-full resize-none p-3 text-[13px]"
          />
        ) : (
          <p className="text-xs text-mute">Save this to keep notes on it.</p>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="label">More like this</h3>
          {!more && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn"
            >
              {loadingMore ? "digging…" : "dig"}
            </button>
          )}
        </div>
        {more && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            className="-mx-6 mt-4 flex gap-3 overflow-x-auto px-6 pb-2 sm:-mx-8 sm:px-8"
          >
            {more.length === 0 && <p className="text-sm text-mute">Nothing close found.</p>}
            {more.map((t) => (
              <motion.button
                key={t.id}
                variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}
                onClick={() => open(t)}
                className="w-32 shrink-0 text-left"
              >
                <div className="aspect-square overflow-hidden rounded-lg ring-1 ring-line">
                  <Artwork track={t} />
                </div>
                <div className="mt-2 truncate text-sm">{t.title}</div>
                <div className="truncate text-xs text-mute">{t.artist}</div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="btn rounded-full px-3 py-1"
    >
      {children} <span className="text-mute">↗</span>
    </a>
  );
}

function AddToCrate({ artist }: { artist: string }) {
  const { profile, update } = useProfile();
  const inCrates = profile.crates.filter((c) => c.artists.some((a) => a.toLowerCase() === artist.toLowerCase()));
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-mute">
      {inCrates.length ? <span>In: {inCrates.map((c) => c.name).join(", ")}</span> : <span>Not in your crates</span>}
      <select
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          update((p) => ({
            crates: p.crates.map((c) => (c.id === id && !c.artists.includes(artist) ? { ...c, artists: [artist, ...c.artists] } : c)),
          }));
        }}
        className="field cursor-pointer"
      >
        <option value="">+ Add {artist.length > 22 ? "artist" : artist} to crate</option>
        {profile.crates
          .filter((c) => !inCrates.includes(c))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
    </div>
  );
}
