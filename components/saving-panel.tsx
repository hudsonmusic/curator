"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { clearHelperJob, revealJob, useHelperJobs } from "@/lib/helper";
import { AbletonIcon } from "./ableton";
import { toast } from "./toast";

const SHOW_DONE_FOR = 8000;

/** A small floating panel with a progress bar for each song being saved for Ableton. */
export function SavingPanel() {
  const jobs = useHelperJobs();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Working ones, plus finished ones for a few seconds (errors until dismissed).
  const shown = jobs
    .filter(([, j]) => !j.sent && (j.state !== "done" || now - (j.finished ?? now) < SHOW_DONE_FOR))
    .slice(0, 4);

  return (
    <div className="pointer-events-none fixed bottom-[5.5rem] left-3 z-[45] flex w-[min(320px,calc(100vw-1.5rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {shown.map(([trackId, j]) => {
          const working = j.state !== "done" && j.state !== "error";
          const pct = j.state === "converting" ? 96 : j.state === "done" ? 100 : Math.round(j.progress * 100);
          return (
            <motion.div
              key={trackId}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="glass-strong pointer-events-auto rounded-xl border border-white/[0.1] p-3 shadow-[0_16px_40px_rgb(0_0_0/0.5)]"
            >
              <div className="flex items-center gap-2 text-[12px]">
                <span className={j.state === "error" ? "text-[#ff6b6b]" : "text-accent"}>
                  <AbletonIcon />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{j.name ?? "Song"}</span>
                {j.state === "done" ? (
                  <button
                    onClick={() => void revealJob(j.id).catch(() => toast("The helper isn't running."))}
                    className="shrink-0 text-accent hover:underline"
                  >
                    Show in Finder
                  </button>
                ) : j.state === "error" ? (
                  <button onClick={() => clearHelperJob(trackId)} className="shrink-0 text-mute hover:text-paper" aria-label="Dismiss">
                    ×
                  </button>
                ) : (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-mute">{pct}%</span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${j.state === "error" ? "bg-[#ff6b6b]" : "bg-accent"} ${
                    working && j.state !== "downloading" ? "animate-pulse" : ""
                  }`}
                  style={{ width: `${j.state === "error" ? 100 : Math.max(4, pct)}%` }}
                />
              </div>
              <div className="mt-1.5 truncate text-[11px] text-mute">
                {j.state === "queued"
                  ? "Getting ready…"
                  : j.state === "downloading"
                    ? "Downloading the full song"
                    : j.state === "converting"
                      ? "Tagging with BPM, key and cover"
                      : j.state === "done"
                        ? `Saved${j.file ? ` · ${j.file.split("/").pop()}` : ""}`
                        : (j.error ?? "Couldn't save it")}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
