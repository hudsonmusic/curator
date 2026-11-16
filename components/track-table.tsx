"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { requestAnalysis } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { Artwork } from "./artwork";
import { Equalizer } from "./equalizer";
import { PauseIcon, PlayIcon, usePlayer } from "./player";
import { useSheet } from "./sheet";
import { TYPE_LABEL, metaOf } from "./meta";

export interface Group {
  label?: string;
  tracks: Track[];
}

type SortKey = "default" | "title" | "year" | "bpm" | "key";

const COLS =
  "grid grid-cols-[28px_32px_minmax(0,1fr)_44px_52px_60px_24px] items-center gap-x-3 md:grid-cols-[28px_32px_minmax(0,1fr)_48px_minmax(0,120px)_52px_76px_70px_24px]";

function camelotSortValue(cam?: string) {
  const m = cam?.match(/^(\d+)([AB])$/);
  return m ? +m[1] * 2 + (m[2] === "B" ? 1 : 0) : 999;
}

export function TrackTable({ groups, emptyText }: { groups: Group[]; emptyText: string }) {
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
    for (const t of flat) if (t.audioUrl && t.source !== "ccmixter") requestAnalysis(t);
  }, [flat]);

  useEffect(() => setSel(0), [groups]);

  // Keep the highlight on whatever is playing, e.g. after auto-advance.
  const currentId = player.track?.id;
  useEffect(() => {
    const i = flat.findIndex((t) => t.id === currentId);
    if (i >= 0) {
      setSel(i);
      listRef.current?.querySelector(`[data-row="${i}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentId, flat]);

  const playRow = (t: Track) => {
    if (!t.audioUrl) return sheet.open(t);
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
        const next = Math.max(0, Math.min(flat.length - 1, sel + (e.key === "ArrowDown" || e.key === "j" ? 1 : -1)));
        setSel(next);
        listRef.current?.querySelector(`[data-row="${next}"]`)?.scrollIntoView({ block: "nearest" });
        if (flat[next]?.audioUrl) player.play(flat[next], undefined, flat);
      } else if (e.key === " " && t) {
        e.preventDefault();
        playRow(t);
      } else if (e.key === "Enter" && t) {
        sheet.open(t);
      } else if (e.key === "s" && t) {
        toggleSave(t);
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
            <div className="label px-3 pb-1 pt-4">{g.label}</div>
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
                  if (t.audioUrl && player.track?.id !== t.id) player.play(t, undefined, flat);
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
        className={`grid size-7 place-items-center rounded-full transition-all duration-150 active:scale-90 ${current ? "bg-acid text-ink" : "text-mute hover:bg-white/[0.12] hover:text-paper"}`}
        aria-label={playing ? "Pause" : t.audioUrl ? "Play" : "Open"}
      >
        {playing ? <PauseIcon className="size-3" /> : t.audioUrl ? <PlayIcon className="size-3" /> : <span className="text-[11px]">↗</span>}
      </button>
      <div className="size-8 overflow-hidden rounded-md shadow-[0_1px_3px_rgb(0_0_0/0.4)]">
        <Artwork track={t} />
      </div>
      <button onClick={onOpen} className="min-w-0 text-left">
        <div className={`flex items-center gap-2 truncate font-medium ${current ? "text-acid" : ""}`}>
          {playing && <Equalizer />}
          <span className="truncate">{t.title}</span>
        </div>
        <div className="truncate text-xs text-mute">{t.artist}</div>
      </button>
      <span className="font-mono text-xs text-mute">{t.year ?? "—"}</span>
      <span className="hidden truncate text-xs text-mute md:block">{t.genre ?? "—"}</span>
      <span className="font-mono text-xs">{m.bpm ? Math.round(m.bpm) : m.analyzing ? <span className="text-mute">···</span> : <span className="text-mute">—</span>}</span>
      <span className="font-mono text-xs">
        {m.cam ? (
          <>
            <span className="inline-block w-7">{m.cam}</span>
            <span className="text-mute">{m.key}</span>
          </>
        ) : m.analyzing ? (
          <span className="text-mute">···</span>
        ) : (
          <span className="text-mute">—</span>
        )}
      </span>
      <span className="hidden text-xs text-mute md:block">{TYPE_LABEL[t.type]}</span>
      <div className="flex items-center justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          aria-label={saved ? "Unsave" : "Save"}
          className={saved ? "text-acid" : "text-mute opacity-0 hover:text-paper group-hover:opacity-100"}
        >
          <svg viewBox="0 0 24 24" className={`size-4 ${saved ? "fill-current" : "fill-none"} stroke-current`} strokeWidth="2">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
