"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { TrackCard } from "./track-card";

export function TrackGrid({ tracks, dismissable = true }: { tracks: Track[]; dismissable?: boolean }) {
  const { signal } = useProfile();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = tracks.filter((t) => !hidden.has(t.id));

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.045 } } }}
      className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <AnimatePresence mode="popLayout">
        {visible.map((t) => (
          <TrackCard
            key={t.id}
            track={t}
            onDismiss={
              dismissable
                ? (tr) => {
                    signal("pass", tr);
                    setHidden((h) => new Set(h).add(tr.id));
                  }
                : undefined
            }
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export function GridSkeleton({ n = 10 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="aspect-square rounded-xl bg-panel ring-1 ring-line" />
          <div className="mt-3 h-5 w-3/4 rounded bg-panel" />
          <div className="mt-2 h-3.5 w-1/2 rounded bg-panel" />
        </div>
      ))}
    </div>
  );
}
