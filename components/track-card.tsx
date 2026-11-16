"use client";

import { motion } from "framer-motion";
import type { Track } from "@/lib/types";
import { bpmOf, useAnalysis } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";
import { camelotCompatible, camelotOf } from "@/lib/keys";
import { Artwork } from "./artwork";
import { Equalizer } from "./equalizer";
import { PauseIcon, PlayIcon, usePlayer } from "./player";
import { useSheet } from "./sheet";

export const TYPE_LABEL = { acapella: "Acapella", loop: "Loop", song: "Song" } as const;

export const cardVariants = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring" as const, stiffness: 220, damping: 26 } },
  exit: { opacity: 0, scale: 0.9, filter: "blur(6px)", transition: { duration: 0.2 } },
};

export function useTrackMeta(track: Track) {
  const { profile } = useProfile();
  const entry = useAnalysis(track);
  const bpm = bpmOf(track, entry);
  const key = entry?.data?.key ?? track.sourceKey;
  const cam = entry?.data?.camelot || (key ? camelotOf(key) : null);
  const inRange = bpm ? [bpm, bpm * 2, bpm / 2].some((b) => b >= profile.bpmMin && b <= profile.bpmMax) : false;
  const mixesWith = cam ? profile.references.find((r) => r.camelot && camelotCompatible(r.camelot, cam)) : undefined;
  return { entry, bpm, key, cam, inRange, mixesWith };
}

export function TrackCard({ track, onDismiss }: { track: Track; onDismiss?: (t: Track) => void }) {
  const player = usePlayer();
  const sheet = useSheet();
  const { saved, toggleSave } = useProfile();
  useAnalysis(track, !!track.audioUrl && track.source !== "ccmixter");
  const { entry, bpm, key, cam, inRange, mixesWith } = useTrackMeta(track);
  const playing = player.isPlaying(track.id);
  const isSaved = !!saved[track.id];
  const loopRich = track.type === "song" && (entry?.data?.melodic ?? 0) >= 0.6;
  const analyzing = entry?.status === "loading" || entry?.status === "queued";

  return (
    <motion.article layout variants={cardVariants} exit="exit" className="group relative min-w-0">
      <div
        onClick={() => sheet.open(track)}
        className="relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-panel ring-1 ring-line transition-shadow duration-300 group-hover:shadow-[0_20px_60px_-20px_rgba(215,255,69,0.18)]"
      >
        <motion.div layoutId={`art-${track.id}`} className="size-full transition-transform duration-700 ease-out group-hover:scale-[1.04]">
          <Artwork track={track} />
        </motion.div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/30 opacity-70 transition-opacity group-hover:opacity-100" />

        <div className="absolute left-2.5 top-2.5 flex gap-1.5 font-mono text-[10px] uppercase tracking-widest">
          <span className="rounded-full bg-ink/70 px-2 py-0.5 text-paper/90 backdrop-blur">{TYPE_LABEL[track.type]}</span>
          {loopRich && <span className="rounded-full bg-acid px-2 py-0.5 text-ink">loop-rich</span>}
        </div>

        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(track);
            }}
            title="Not for me"
            className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-ink/70 text-paper/70 opacity-0 backdrop-blur transition-opacity hover:text-paper group-hover:opacity-100"
          >
            <svg viewBox="0 0 16 16" className="size-3" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (track.audioUrl) player.toggle(track);
            else sheet.open(track);
          }}
          aria-label={playing ? "Pause" : "Play"}
          className={`absolute bottom-2.5 right-2.5 grid size-11 place-items-center rounded-full bg-paper text-ink shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 ${
            playing ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
          }`}
        >
          {playing ? <PauseIcon /> : track.audioUrl ? <PlayIcon /> : <ArrowIcon />}
        </button>
        {playing && <Equalizer className="absolute bottom-4 left-3" />}
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <button onClick={() => sheet.open(track)} className="min-w-0 text-left">
          <h3 className="truncate font-display text-[1.35rem] leading-tight">{track.title}</h3>
          <p className="truncate text-sm text-mute">{track.artist}</p>
        </button>
        <button
          onClick={() => toggleSave(track)}
          aria-label={isSaved ? "Unsave" : "Save"}
          className="mt-1 shrink-0 text-mute transition-colors hover:text-paper"
        >
          <motion.svg
            key={String(isSaved)}
            initial={{ scale: isSaved ? 0.6 : 1 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            viewBox="0 0 24 24"
            className={`size-5 ${isSaved ? "fill-acid stroke-acid" : "fill-none stroke-current"}`}
            strokeWidth="1.8"
          >
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </motion.svg>
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-mute">
        {track.year && <span>{track.year}</span>}
        {track.genre && <span className="max-w-[9rem] truncate">{track.genre}</span>}
        {bpm ? (
          <span className={inRange ? "text-acid" : ""}>{Math.round(bpm)} bpm</span>
        ) : analyzing ? (
          <span className="animate-pulse">··· bpm</span>
        ) : null}
        {key && (
          <span className={mixesWith ? "text-acid" : ""} title={mixesWith ? `Mixes with ${mixesWith.name}` : undefined}>
            {key}
            {cam ? ` · ${cam}` : ""}
          </span>
        )}
      </div>
    </motion.article>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 11L11 5M6 5h5v5" />
    </svg>
  );
}
