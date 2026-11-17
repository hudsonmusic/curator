"use client";

import type { Track } from "@/lib/types";
import { Artwork } from "./artwork";

/**
 * A record with the cover art as its centre label. It spins while the song plays
 * (33⅓ rpm) and stops where it is when paused. The light sheen stays put, like a real one.
 */
export function Vinyl({
  track,
  spinning,
  label = 0.42,
  className = "",
}: {
  track: Track;
  spinning: boolean;
  /** Label size as a fraction of the record. */
  label?: number;
  className?: string;
}) {
  const inset = `${((1 - label) / 2) * 100}%`;
  return (
    <div className={`relative aspect-square rounded-full shadow-[0_10px_30px_rgb(0_0_0/0.55)] ${className}`}>
      <div className="vinyl-spin absolute inset-0 rounded-full" style={{ animationPlayState: spinning ? "running" : "paused" }}>
        <div className="vinyl-grooves absolute inset-0 rounded-full" />
        <div className="absolute overflow-hidden rounded-full" style={{ inset }}>
          <Artwork track={track} />
        </div>
      </div>
      <div className="vinyl-sheen pointer-events-none absolute inset-0 rounded-full" />
      <div className="absolute left-1/2 top-1/2 size-[4%] min-h-[3px] min-w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-[inset_0_1px_1px_rgb(0_0_0/0.8)]" />
    </div>
  );
}
