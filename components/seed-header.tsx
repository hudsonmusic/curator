"use client";

import type { Track } from "@/lib/types";
import { Artwork } from "./artwork";
import { PauseIcon, PlayIcon, usePlayer } from "./player";
import { useSheet } from "./sheet";

/** The song a Similar songs list started from: cover (tap to play), "Sounds like" its title and artist. */
export function SeedHeader({ track }: { track: Track }) {
  const player = usePlayer();
  const sheet = useSheet();
  const playing = player.isPlaying(track.id);
  const playable = player.canPlay(track);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        onClick={() => (playable ? player.toggle(track) : sheet.open(track))}
        aria-label={playing ? "Pause" : "Play"}
        title={playing ? "Pause" : "Play the song these are like"}
        className="group relative size-11 shrink-0 overflow-hidden rounded-lg shadow-[0_4px_14px_rgb(0_0_0/0.45)]"
      >
        <Artwork track={track} />
        <span
          className={`absolute inset-0 grid place-items-center bg-black/45 text-white transition-opacity ${playing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          {playing ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
        </span>
      </button>
      <div className="min-w-0">
        <div className="label leading-none">Songs that sound like</div>
        <button onClick={() => sheet.open(track)} className="block max-w-full truncate text-left text-[17px] font-semibold tracking-tight hover:underline">
          {track.title}
          <span className="font-normal text-paper/60"> · {track.artist}</span>
        </button>
      </div>
    </div>
  );
}
