"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { requestAnalysis } from "@/lib/analysis-store";
import { requestStyles, similarity } from "@/lib/style-store";
import { useProfile } from "@/lib/profile";
import { Artwork } from "./artwork";
import { Equalizer } from "./equalizer";
import { PauseIcon, PlayIcon, usePlayer } from "./player";
import { useSheet } from "./sheet";
import { TYPE_LABEL, metaOf } from "./meta";
import { OpenIn } from "./open-in";
import { sendToDownie } from "./downie";
import { Pivot, RelatedButton } from "./related";

export interface Group {
  label?: string;
  /** A short note beside the group's label. */
  note?: string;
  tracks: Track[];
}

type SortKey = "default" | "title" | "year" | "bpm" | "key";

const COLS =
  "grid grid-cols-[28px_32px_minmax(0,1fr)_44px_52px_60px_84px] items-center gap-x-3 md:grid-cols-[28px_32px_minmax(0,1fr)_48px_minmax(0,120px)_52px_76px_70px_84px]";

function camelotSortValue(cam?: string) {
  const m = cam?.match(/^(\d+)([AB])$/);
  return m ? +m[1] * 2 + (m[2] === "B" ? 1 : 0) : 999;
}

export function TrackTable({ groups, emptyText, seedId }: { groups: Group[]; emptyText: string; seedId?: string }) {
  const player = usePlayer();
  const sheet = useSheet();
  const { saved, toggleSave, profile } = useProfile();
  const disliked = useMemo(() => new Set(profile.disliked), [profile.disliked]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "default", dir: 1 });
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    const cmp = (a: Track, b: Track) => {
      const ma = metaOf(a), mb = metaOf(b);
      switch (sort.key) {
        case "title": return a.title.localeCompare(b.title) * sort.dir;
        case "year": return ((a.year ?? 9999) - (b.year ?? 9999)) * sort.dir;
        case "bpm": return ((ma.bpm ?? 999) - (mb.bpm ?? 999)) * sort.dir;
        case "key": return (camelotSortValue(ma.cam) - camelotSortValue(mb.cam)) * sort.dir;
        default: return 0;
      }
    };
    return groups.map((g) => ({ ...g, tracks: g.tracks.filter((t) => !disliked.has(t.id)).slice().sort(cmp) }));
  }, [groups, sort, disliked]);
  const flat = useMemo(() => sorted.flatMap((g) => g.tracks), [sorted]);

  // Analyse everything listed, in order, so BPM/key fill in and filters work.
  useEffect(() => {
    for (const t of flat) if (t.audioUrl && t.source !== "ccmixter" && t.source !== "soundcloud") requestAnalysis(t);
    for (const t of flat) requestStyles(t);
  }, [flat]);

  // Reset the selection only when the list itself changes, not on every re-render
  // (BPM/style results arriving re-render the table many times a second).
  const listKey = useMemo(() => flat.map((t) => t.id).join(","), [flat]);
  useEffect(() => setSel(0), [listKey]);

  // Keep the highlight on whatever is playing (e.g. after autoplay moves on), but
  // never scroll the page for you: you stay wherever you've scrolled to.
  const currentId = player.track?.id;
  useEffect(() => {
    const i = flat.findIndex((t) => t.id === currentId);
    if (i >= 0) setSel(i);
  }, [currentId, flat]);

  const playRow = (t: Track) => {
    if (!player.canPlay(t)) return sheet.open(t);
    if (player.track?.id === t.id) player.toggle();
    else player.play(t, undefined, flat);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || sheet.track) return;
      const t = flat[sel];
      if (e.key === "ArrowDown" || e.key === "j" || e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const down = e.key === "ArrowDown" || e.key === "j";
        // If the selected song has been scrolled out of view, start from what's on screen
        // instead of jumping back to it.
        const onScreen = (i: number) => {
          const r = listRef.current?.querySelector(`[data-row="${i}"]`)?.getBoundingClientRect();
          return !!r && r.top >= 90 && r.bottom <= window.innerHeight - 96;
        };
        let from = sel;
        if (!onScreen(sel)) {
          const visible = flat.map((_, i) => i).filter(onScreen);
          if (visible.length) from = down ? visible[0] - 1 : visible[visible.length - 1] + 1;
        }
        const next = Math.max(0, Math.min(flat.length - 1, from + (down ? 1 : -1)));
        setSel(next);
        listRef.current?.querySelector(`[data-row="${next}"]`)?.scrollIntoView({ block: "nearest" });
        if (flat[next] && player.canPlay(flat[next])) player.play(flat[next], undefined, flat);
      } else if (e.key === " " && t) {
        e.preventDefault();
        playRow(t);
      } else if (e.key === "Enter" && t) {
        sheet.open(t);
      } else if (e.key === "s" && t) {
        toggleSave(t);
      } else if (e.key === "d" && t && profile.downie && !e.metaKey && !e.ctrlKey) {
        void sendToDownie(t, profile.downieAudio);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const header = (key: SortKey, label: string, className = "") => (
    <button
      onClick={() => setSort((s) => (s.key === key ? (s.dir === 1 ? { key, dir: -1 } : { key: "default", dir: 1 }) : { key, dir: 1 }))}
      className={`text-left transition-colors hover:text-paper ${sort.key === key ? "text-paper" : ""} ${className}`}
    >
      {label}
      {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
    </button>
  );

  if (!flat.length) return <div className="fade-up px-4 py-16 text-center text-mute">{emptyText}</div>;

  let idx = -1;
  return (
    <div ref={listRef} className="px-2">
      <div className={`${COLS} glass sticky top-14 z-10 -mx-2 border-b border-line px-5 py-1.5 text-[11px] font-medium text-mute`}>
        <span />
        <span />
        {header("title", "Title")}
        {header("year", "Year")}
        <span className="hidden md:block">Genre</span>
        {header("bpm", "BPM")}
        {header("key", "Key")}
        <span className="hidden md:block">Type</span>
        <span />
      </div>
      {sorted.map((g, gi) => (
        <div key={gi}>
          {g.label && g.tracks.length > 0 && (
            <div className="flex items-baseline gap-2 px-3 pb-1 pt-4">
              <span className="label">{g.label}</span>
              {g.note && <span className="truncate text-[11px] text-mute/80">{g.note}</span>}
            </div>
          )}
          {g.tracks.map((t) => {
            idx++;
            const i = idx;
            return (
              <Row
                key={t.id}
                track={t}
                index={i}
                selected={i === sel}
                playing={player.isPlaying(t.id)}
                current={player.track?.id === t.id}
                saved={!!saved[t.id]}
                onSelect={() => {
                  setSel(i);
                  if (player.canPlay(t) && player.track?.id !== t.id) player.play(t, undefined, flat);
                }}
                onPlay={() => {
                  setSel(i);
                  playRow(t);
                }}
                onOpen={() => {
                  setSel(i);
                  sheet.open(t);
                }}
                onSave={() => toggleSave(t)}
                playable={player.canPlay(t)}
                match={seedId ? similarity(seedId, t.id) : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Row({
  track: t,
  index,
  selected,
  playing,
  current,
  saved,
  onSelect,
  onPlay,
  onOpen,
  onSave,
  playable,
  match,
}: {
  track: Track;
  index: number;
  selected: boolean;
  playing: boolean;
  current: boolean;
  saved: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onOpen: () => void;
  onSave: () => void;
  playable: boolean;
  /** How alike this sounds to the song a related search started from (0–1). */
  match?: number;
}) {
  const m = metaOf(t);
  return (
    <div
      data-row={index}
      onClick={onSelect}
      onDoubleClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 20) * 12}ms` }}
      className={`fade-up group ${COLS} h-11 cursor-default rounded-lg px-3 text-[13px] transition-colors duration-150 ${
        selected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className={`grid size-7 place-items-center rounded-full transition-all duration-150 active:scale-90 ${current ? "bg-accent text-onaccent" : "text-mute hover:bg-white/[0.12] hover:text-paper"}`}
        aria-label={playing ? "Pause" : playable ? "Play" : "Open"}
      >
        {playing ? <PauseIcon className="size-3" /> : playable ? <PlayIcon className="size-3" /> : <span className="text-[11px]">↗</span>}
      </button>
      <div className="size-8 overflow-hidden rounded-md shadow-[0_1px_3px_rgb(0_0_0/0.4)]">
        <Artwork track={t} />
      </div>
      <div className="min-w-0">
        <button onClick={onOpen} className={`flex max-w-full items-center gap-2 truncate text-left font-medium ${current ? "text-accent" : ""}`}>
          {playing && <Equalizer />}
          <span className="truncate">{t.title}</span>
        </button>
        <div className="flex min-w-0 items-center gap-1 text-xs text-mute">
          <span className="truncate">{t.artist}</span>
          {t.label && (
            <>
              <span className="shrink-0 opacity-50">·</span>
              <Pivot by="label" value={t.label} track={t} className="min-w-0 shrink opacity-80">
                {t.label}
              </Pivot>
            </>
          )}
          {t.deep && <span className="shrink-0 rounded bg-white/[0.08] px-1 text-[10px] leading-4 text-paper/70">deep cut</span>}
        </div>
      </div>
      <Pivot by="year" value={t.year} track={t} className="font-mono text-xs text-mute">
        {t.year ?? "—"}
      </Pivot>
      <Pivot by="genre" value={m.genre} track={t} className="hidden text-xs text-mute md:block">
        <span title={m.style ? `${m.style.genre} · heard by the style model (${Math.round(m.style.score * 100)}%)` : undefined}>{m.genre ?? "—"}</span>
      </Pivot>
      <span className="font-mono text-xs">
        {m.bpm ? (
          <Pivot by="bpm" value={Math.round(m.bpm)} track={t}>
            {Math.round(m.bpm)}
          </Pivot>
        ) : m.analyzing ? (
          <span className="text-mute">···</span>
        ) : (
          <span className="text-mute">—</span>
        )}
      </span>
      <span className="font-mono text-xs">
        {m.cam ? (
          <Pivot by="key" value={m.cam} track={t}>
            <span className="inline-block w-7">{m.cam}</span>
            <span className="text-mute">{m.key}</span>
          </Pivot>
        ) : m.analyzing ? (
          <span className="text-mute">···</span>
        ) : (
          <span className="text-mute">—</span>
        )}
      </span>
      {match !== undefined ? (
        <span className="hidden font-mono text-xs text-accent md:block" title="How alike it sounds to the song you started from">
          {Math.round(match * 100)}% match
        </span>
      ) : (
        <span className="hidden text-xs text-mute md:block">{TYPE_LABEL[t.type]}</span>
      )}
      <div className="flex items-center justify-end gap-1">
        {t.type === "song" && <RelatedButton track={t} />}
        <OpenIn track={t} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          aria-label={saved ? "Unsave" : "Save"}
          className={saved ? "text-accent" : "text-mute opacity-0 hover:text-paper group-hover:opacity-100"}
        >
          <svg viewBox="0 0 24 24" className={`size-4 ${saved ? "fill-current" : "fill-none"} stroke-current`} strokeWidth="2">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
