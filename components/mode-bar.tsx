"use client";

import { useMemo } from "react";
import type { DigFor, Flow, Mode, Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { getEntry } from "@/lib/analysis-store";
import { camelotCompatible } from "@/lib/keys";
import { TEMPO_PRESETS, flowTarget, tempoGap } from "@/lib/modes";
import { Segmented } from "./segmented";
import { metaOf } from "./meta";
import { usePlayer } from "./player";
import { Artwork } from "./artwork";
import { trackMenu } from "./track-menu";

/** Producer / DJ switch for the header. */
export function ModeSwitch() {
  const { profile, update } = useProfile();
  return (
    <div title="Producer digs for samples. DJ builds a set." className="shrink-0">
      <Segmented<Mode>
        value={profile.mode}
        options={[
          { id: "producer", label: "Producer" },
          { id: "dj", label: "DJ" },
        ]}
        onChange={(mode) => update({ mode })}
      />
    </div>
  );
}

const DIG: { id: DigFor; label: string }[] = [
  { id: "any", label: "Anything" },
  { id: "loops", label: "Loops & breaks" },
  { id: "vocals", label: "Vocals" },
];
const FLOW: { id: Flow; label: string }[] = [
  { id: "cool", label: "Bring down" },
  { id: "hold", label: "Hold" },
  { id: "build", label: "Build up" },
];

/** The mode's own controls, at the start of the filter row. */
export function ModeControls({ setTempo }: { setTempo: (bpm: [number, number] | null) => void }) {
  const { profile, update } = useProfile();
  if (profile.mode === "producer") {
    return <Segmented value={profile.digFor} options={DIG} onChange={(digFor) => update({ digFor })} />;
  }
  const dj = profile.dj;
  const setDj = (p: Partial<typeof dj>) => update((prev) => ({ dj: { ...prev.dj, ...p } }));
  const preset = dj.bpm ? TEMPO_PRESETS.findIndex((p) => p.bpm[0] === dj.bpm![0] && p.bpm[1] === dj.bpm![1]) : -1;
  return (
    <>
      <select
        value={dj.bpm ? String(preset) : ""}
        onChange={(e) => {
          const bpm = e.target.value === "" ? null : TEMPO_PRESETS[+e.target.value]?.bpm ?? dj.bpm;
          setDj({ bpm });
          setTempo(bpm);
        }}
        className="field cursor-pointer"
        title="The tempo range of your set"
      >
        <option value="">Any tempo</option>
        {TEMPO_PRESETS.map((p, i) => (
          <option key={p.label} value={i}>
            {p.label}
          </option>
        ))}
        {dj.bpm && preset < 0 && <option value="-1">{`${dj.bpm[0]}–${dj.bpm[1]} BPM`}</option>}
      </select>
      <Segmented value={dj.flow} options={FLOW} onChange={(flow) => setDj({ flow })} />
      <button
        onClick={() => setDj({ follow: !dj.follow })}
        className={`btn ${dj.follow ? "btn-on" : ""}`}
        title="Show what mixes into the song that's playing"
      >
        Mix from deck
      </button>
      <button
        onClick={() => setDj({ extended: !dj.extended })}
        className={`btn ${dj.extended ? "btn-on" : ""}`}
        title="Favour extended and 12″ versions; hide songs under 4 minutes"
      >
        Long versions
      </button>
    </>
  );
}

/** How well a track mixes out of the deck (higher is better), or null if it doesn't. */
export function mixScore(deck: { bpm?: number; cam?: string }, t: Track, flow: Flow): number | null {
  const m = metaOf(t);
  if (!deck.bpm || !deck.cam || !m.bpm || !m.cam) return null;
  const gap = tempoGap(flowTarget(deck.bpm, flow), m.bpm);
  if (gap > 0.07) return null;
  const key = m.cam === deck.cam ? 1 : camelotCompatible(m.cam, deck.cam) ? 0.75 : 0;
  if (!key) return null;
  return key + (1 - gap / 0.07);
}

/** A short badge for a row in the current mode, or null. */
export function useRowBadge(): (t: Track) => { label: string; title: string } | null {
  const { profile } = useProfile();
  const player = usePlayer();
  const deck = player.track ? metaOf(player.track) : null;
  const deckId = player.track?.id;
  return (t) => {
    if (profile.mode === "dj") {
      if (!deck || t.id === deckId) return null;
      return mixScore(deck, t, profile.dj.flow) !== null ? { label: "mixes", title: `Key and tempo mix out of ${player.track!.title}` } : null;
    }
    const melodic = getEntry(t.id)?.data?.melodic;
    return melodic !== undefined && melodic >= 0.6 && t.type === "song"
      ? { label: "loopable", title: "Has clean, drum-light parts that loop well" }
      : null;
  };
}

/**
 * DJ: the songs in this list that mix best out of the one playing.
 * Producer (loops): the cleanest-sounding records to loop.
 */
export function ModePicks({ tracks }: { tracks: Track[] }) {
  const { profile } = useProfile();
  const player = usePlayer();
  const deck = player.track;
  const deckMeta = deck ? metaOf(deck) : null;
  const dj = profile.mode === "dj";
  const picks = useMemo(() => {
    if (dj) {
      if (!deckMeta?.bpm || !deckMeta.cam || !profile.dj.follow) return [];
      return tracks
        .filter((t) => t.id !== deck!.id && t.type === "song")
        .map((t) => ({ t, s: mixScore(deckMeta, t, profile.dj.flow) }))
        .filter((x) => x.s !== null)
        .sort((a, b) => b.s! - a.s!)
        .slice(0, 8)
        .map((x) => x.t);
    }
    if (profile.digFor !== "loops") return [];
    return tracks
      .map((t) => ({ t, s: getEntry(t.id)?.data?.melodic ?? 0 }))
      .filter((x) => x.s >= 0.6 && x.t.type === "song")
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.t);
    // Recompute when the deck or its analysis changes, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, dj, deck?.id, deckMeta?.bpm, deckMeta?.cam, profile.dj.flow, profile.dj.follow, profile.digFor]);

  if (dj && profile.dj.follow && !deckMeta?.bpm) {
    return <div className="mx-4 mb-2 rounded-xl border border-dashed border-line px-3 py-2 text-[12px] text-mute">Play a song and what mixes out of it shows here.</div>;
  }
  if (!picks.length) return null;
  const flowNote = profile.dj.flow === "build" ? "a little faster" : profile.dj.flow === "cool" ? "a little slower" : "same tempo";
  return (
    <div className="fade-up mb-2 px-4">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[12px] font-semibold">{dj ? `Mixes out of “${deck!.title}”` : "Best to loop"}</span>
        <span className="text-[11px] text-mute">{dj ? `Compatible key · ${flowNote}` : "Clean, drum-light parts"}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {picks.map((t) => {
          const m = metaOf(t);
          const gap = dj && deckMeta?.bpm && m.bpm ? Math.round(((m.bpm - deckMeta.bpm) / deckMeta.bpm) * 100) : null;
          return (
            <button
              key={t.id}
              onClick={() => (player.track?.id === t.id ? player.toggle() : player.play(t, undefined, picks))}
              onContextMenu={trackMenu(t, () => player.play(t, undefined, picks))}
              className="flex w-44 shrink-0 items-center gap-2 rounded-xl bg-white/[0.04] p-1.5 text-left transition-colors hover:bg-white/[0.08]"
            >
              <span className="size-9 shrink-0 overflow-hidden rounded-md">
                <Artwork track={t} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium">{t.title}</span>
                <span className="block truncate text-[11px] text-mute">
                  {dj ? `${Math.round(m.bpm ?? 0)} · ${m.cam}${gap ? ` · ${gap > 0 ? "+" : ""}${gap}%` : ""}` : t.artist}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Sun/moon button in the header: flips between light and dark. */
export function ThemeButton() {
  const { profile, update } = useProfile();
  const light =
    profile.theme === "light" || (profile.theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches);
  return (
    <button
      onClick={() => update({ theme: light ? "dark" : "light" })}
      aria-label={light ? "Dark mode" : "Light mode"}
      title={light ? "Dark mode" : "Light mode"}
      className="grid size-8 place-items-center rounded-lg text-mute transition-colors hover:bg-white/[0.08] hover:text-paper"
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
        {light ? (
          <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />
        ) : (
          <>
            <circle cx="8" cy="8" r="2.8" />
            <path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
          </>
        )}
      </svg>
    </button>
  );
}
