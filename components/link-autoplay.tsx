"use client";

import { useEffect } from "react";
import type { Track } from "@/lib/types";
import { usePlayer } from "./player";

/** Starts a pasted link as soon as it's been opened. */
export function LinkAutoplay({ opened }: { opened: { tracks: Track[] } | null }) {
  const { play } = usePlayer();
  useEffect(() => {
    if (opened?.tracks[0]) play(opened.tracks[0], undefined, opened.tracks);
  }, [opened, play]);
  return null;
}
