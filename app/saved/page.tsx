"use client";

import { useState } from "react";
import Link from "next/link";
import type { SampleType } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { TrackGrid } from "@/components/track-grid";
import { Chip, Eyebrow, Headline } from "@/components/ui";

export default function SavedPage() {
  const { ready, saved, markers } = useProfile();
  const [type, setType] = useState<"all" | SampleType>("all");
  if (!ready) return null;
  const list = Object.values(saved).sort((a, b) => b.savedAt - a.savedAt);
  const shown = list.filter((s) => type === "all" || s.track.type === type).map((s) => s.track);
  const markerCount = Object.values(markers).reduce((n, m) => n + m.length, 0);

  return (
    <div className="pt-12 sm:pt-16">
      <Eyebrow>
        {list.length} saved · {markerCount} chop points
      </Eyebrow>
      <Headline className="mt-3 text-6xl sm:text-8xl">Saved</Headline>
      {list.length ? (
        <>
          <div className="mt-10 flex flex-wrap gap-2">
            {(["all", "song", "acapella", "loop"] as const).map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                {t === "all" ? "All" : t === "song" ? "Songs" : t === "acapella" ? "Acapellas" : "Loops"}
              </Chip>
            ))}
          </div>
          <div className="mt-8">
            <TrackGrid key={type} tracks={shown} dismissable={false} />
          </div>
        </>
      ) : (
        <p className="mt-8 max-w-sm text-mute">
          Nothing saved yet. Tap the heart on anything in your <Link href="/" className="text-paper underline underline-offset-4">crate</Link> to keep it here.
        </p>
      )}
    </div>
  );
}
