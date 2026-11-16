"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { SampleType, Track } from "@/lib/types";
import { SCENES } from "@/lib/scenes";
import { useProfile } from "@/lib/profile";
import { GridSkeleton, TrackGrid } from "@/components/track-grid";
import { Chip, Eyebrow, Headline } from "@/components/ui";

const PLACEHOLDERS = ["Marcos Valle", "Roy Ayers", "Larry Heard", "Sublime", "Pete Rock", "Cerrone", "Azymuth", "Inner City"];
const TABS: { id: "all" | SampleType; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "song", label: "Songs" },
  { id: "acapella", label: "Acapellas" },
  { id: "loop", label: "Loops" },
];

export default function DigPage() {
  const { likedArtists, profile } = useProfile();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | SampleType>("all");
  const [ph, setPh] = useState(0);
  const [results, setResults] = useState<{ title: string; tracks: Track[]; related?: { scene: string; tracks: Track[] } } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPh((i) => (i + 1) % PLACEHOLDERS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const runSearch = async (query: string, t = type) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${t}`);
      const data = (await res.json()) as { tracks: Track[]; related?: { scene: string; tracks: Track[] } };
      setResults({ title: `“${query}”`, ...data });
    } finally {
      setLoading(false);
    }
  };

  const explore = async (sceneId: string) => {
    setLoading(true);
    try {
      const types: SampleType[] = type === "all" ? profile.types : [type];
      const res = await fetch("/api/crate", {
        method: "POST",
        body: JSON.stringify({ scenes: [sceneId], types, likedArtists, exclude: profile.disliked, seed: `${sceneId}:${Date.now()}`, size: 25 }),
      });
      const data = (await res.json()) as { tracks: Track[] };
      setResults({ title: SCENES.find((s) => s.id === sceneId)?.name ?? sceneId, tracks: data.tracks });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-12 sm:pt-16">
      <Eyebrow>Search the stacks</Eyebrow>
      <Headline className="mt-3 text-6xl sm:text-8xl">Dig</Headline>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(q);
        }}
        className="relative mt-10 border-b border-line focus-within:border-paper"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-transparent py-4 pr-16 font-display text-4xl outline-none sm:text-5xl"
          aria-label="Search"
        />
        {!q && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden font-display text-4xl text-mute/50 sm:text-5xl">
            <AnimatePresence mode="wait">
              <motion.span
                key={ph}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -30, opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="italic"
              >
                {PLACEHOLDERS[ph]}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
        <button type="submit" className="absolute bottom-5 right-0 font-mono text-xs uppercase tracking-widest text-mute hover:text-acid">
          search ↵
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Chip
            key={t.id}
            active={type === t.id}
            onClick={() => {
              setType(t.id);
              if (q.trim()) void runSearch(q, t.id);
            }}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="mt-10">
        <Eyebrow>Or explore a scene</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SCENES.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.03 }}
              whileHover={{ y: -3 }}
              onClick={() => explore(s.id)}
              className="rounded-xl border border-line p-3.5 text-left transition-colors hover:border-mute"
            >
              <div className="text-sm">{s.name}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-mute">
                {s.years[0]}–{String(s.years[1]).slice(2)}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mt-14">
        {loading ? (
          <GridSkeleton />
        ) : results ? (
          <>
            <h2 className="mb-6 font-display text-4xl italic">{results.title}</h2>
            {results.tracks.length ? <TrackGrid key={results.title + type} tracks={results.tracks} /> : <p className="text-mute">Nothing turned up.</p>}
            {results.related && results.related.tracks.length > 0 && (
              <div className="mt-16">
                <Eyebrow>From the same scene · {results.related.scene}</Eyebrow>
                <div className="mt-6">
                  <TrackGrid tracks={results.related.tracks} />
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
