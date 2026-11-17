"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/lib/profile";
import { applyAccent } from "@/lib/theme";
import { coverColor } from "@/lib/cover-color";
import { usePlayer } from "./player";

/** Applies your accent, or, with "Cover art colours" on, the playing song's colour. */
export function ThemeSync() {
  const { ready, profile } = useProfile();
  const { track } = usePlayer();
  const [cover, setCover] = useState<{ url: string; color: string | null } | null>(null);
  const art = profile.coverColors ? track?.artwork : undefined;

  useEffect(() => {
    if (!art) return;
    let live = true;
    void coverColor(art).then((color) => live && setCover({ url: art, color }));
    return () => {
      live = false;
    };
  }, [art]);

  const color = art && cover?.url === art ? cover.color : null;
  useEffect(() => {
    if (ready) applyAccent(color ?? profile.accent);
  }, [ready, color, profile.accent]);
  return null;
}
