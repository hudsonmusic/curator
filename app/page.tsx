"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { SampleType, Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { SCENE_BY_ID } from "@/lib/scenes";
import { GridSkeleton, TrackGrid } from "@/components/track-grid";
import { Chip, Eyebrow, Headline } from "@/components/ui";

const TYPE_TABS: { id: "all" | SampleType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "song", label: "Songs" },
  { id: "acapella", label: "Acapellas" },
  { id: "loop", label: "Loops" },
];

export default function CratePage() {
  const { ready, profile, update, likedArtists, saved } = useProfile();
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState(false);
  const [type, setType] = useState<"all" | SampleType>("all");
  const [scene, setScene] = useState<string | null>(null);
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const seed = `${dateKey}:${profile.crateNonce}`;

  useEffect(() => {
    if (ready && !profile.onboarded) router.replace("/welcome");
  }, [ready, profile.onboarded, router]);

  useEffect(() => {
    if (!ready || !profile.onboarded) return;
    const cacheKey = `curator:crate:${seed}:${profile.scenes.join(",")}:${profile.types.join(",")}`;
    try {
      const hit = localStorage.getItem(cacheKey);
      if (hit) {
        setTracks(JSON.parse(hit));
        return;
      }
    } catch {}
    setTracks(null);
    setError(false);
    let cancelled = false;
    fetch("/api/crate", {
      method: "POST",
      body: JSON.stringify({
        scenes: profile.scenes,
        types: profile.types,
        weights: profile.sceneWeights,
        likedArtists,
        exclude: [...profile.disliked, ...Object.keys(saved)],
        seed,
        size: 25,
      }),
    })
      .then((r) => r.json())
      .then(({ tracks }: { tracks: Track[] }) => {
        if (cancelled) return;
        setTracks(tracks);
        try {
          for (const k of Object.keys(localStorage)) if (k.startsWith("curator:crate:")) localStorage.removeItem(k);
          localStorage.setItem(cacheKey, JSON.stringify(tracks));
        } catch {}
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
    // Weights change as you listen; the crate only rebuilds on a new day or "dig deeper".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, seed, profile.onboarded, profile.scenes.join(","), profile.types.join(",")]);

  const scenesHere = useMemo(() => [...new Set((tracks ?? []).map((t) => t.scene).filter(Boolean))] as string[], [tracks]);
  const typesHere = useMemo(() => new Set((tracks ?? []).map((t) => t.type)), [tracks]);
  const shown = (tracks ?? []).filter((t) => (type === "all" || t.type === type) && (!scene || t.scene === scene));

  if (!ready || !profile.onboarded) return null;

  return (
    <div className="pt-12 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>
            {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · crate{" "}
            {String(profile.crateNonce + 1).padStart(2, "0")}
          </Eyebrow>
          <Headline className="mt-3 text-6xl sm:text-8xl">Your crate</Headline>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4 max-w-md text-mute">
            {tracks
              ? `${tracks.length} picks across ${scenesHere.map((s) => SCENE_BY_ID[s]?.name).filter(Boolean).join(", ") || "your scenes"}.`
              : "Pulling records for you…"}
          </motion.p>
        </div>
        <motion.button
          whileHover={{ rotate: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setScene(null);
            update({ crateNonce: profile.crateNonce + 1 });
          }}
          className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm transition-colors hover:border-acid hover:text-acid"
        >
          Dig deeper <span aria-hidden>↻</span>
        </motion.button>
      </div>

      <div className="no-scrollbar -mx-4 mt-10 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {TYPE_TABS.filter((t) => t.id === "all" || typesHere.has(t.id)).map((t) => (
          <Chip key={t.id} active={type === t.id} onClick={() => setType(t.id)}>
            {t.label}
          </Chip>
        ))}
        {scenesHere.length > 1 && <span className="mx-1 w-px shrink-0 bg-line" />}
        {scenesHere.length > 1 &&
          scenesHere.map((s) => (
            <Chip key={s} active={scene === s} onClick={() => setScene(scene === s ? null : s)}>
              {SCENE_BY_ID[s]?.name}
            </Chip>
          ))}
      </div>

      <div className="mt-8">
        {error ? (
          <p className="text-mute">Couldn&apos;t reach the record shops. Try “Dig deeper”.</p>
        ) : tracks ? (
          shown.length ? (
            <TrackGrid key={seed + type + scene} tracks={shown} />
          ) : (
            <p className="text-mute">Nothing here with these filters.</p>
          )
        ) : (
          <GridSkeleton />
        )}
      </div>
    </div>
  );
}
