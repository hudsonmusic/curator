"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { SampleType } from "@/lib/types";
import { EMPTY_FILTERS, filtersActive, type Filters } from "./meta";
import { Segmented } from "./segmented";

const TYPES: { id: "all" | SampleType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "song", label: "Songs" },
  { id: "acapella", label: "Acapellas" },
  { id: "loop", label: "Loops" },
];
const DECADES = [1960, 1970, 1980, 1990, 2000, 2010];
const CAMELOT = Array.from({ length: 12 }, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat();

export function FilterBar({
  f,
  set,
  genres,
  loopsAvailable,
}: {
  f: Filters;
  set: (f: Filters) => void;
  genres: string[];
  loopsAvailable: boolean;
}) {
  const num = (v: string) => (v === "" ? null : Math.max(0, Math.min(250, +v)));
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-3">
      <Segmented value={f.type} options={TYPES.filter((t) => t.id !== "loop" || loopsAvailable)} onChange={(type) => set({ ...f, type })} />

      <div className="flex items-center gap-1.5">
        <span className="label">BPM</span>
        <input
          value={f.bpmLo ?? ""}
          onChange={(e) => set({ ...f, bpmLo: num(e.target.value) })}
          placeholder="min"
          inputMode="numeric"
          className="field w-12 text-center font-mono"
        />
        <span className="text-mute">–</span>
        <input
          value={f.bpmHi ?? ""}
          onChange={(e) => set({ ...f, bpmHi: num(e.target.value) })}
          placeholder="max"
          inputMode="numeric"
          className="field w-12 text-center font-mono"
        />
        <button
          onClick={() => set({ ...f, halfDouble: !f.halfDouble })}
          title="Also match half and double time"
          className={`btn px-2 ${f.halfDouble ? "btn-on" : ""}`}
        >
          ½ × 2
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="label">Key</span>
        <select value={f.key ?? ""} onChange={(e) => set({ ...f, key: e.target.value || null })} className="field cursor-pointer pr-1 font-mono">
          <option value="">Any</option>
          {CAMELOT.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <AnimatePresence>
          {f.key && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden">
              <Segmented
                value={f.keyMode}
                options={[
                  { id: "compatible", label: "Mixes with" },
                  { id: "exact", label: "Exact" },
                ]}
                onChange={(keyMode) => set({ ...f, keyMode })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="label">Era</span>
        <div className="flex rounded-lg bg-white/[0.06] p-0.5">
          {DECADES.map((d) => {
            const on = f.decades.includes(d);
            return (
              <button
                key={d}
                onClick={() => set({ ...f, decades: on ? f.decades.filter((x) => x !== d) : [...f.decades, d] })}
                className={`rounded-md px-2 py-[3px] font-mono text-[11px] transition-all duration-200 ${
                  on ? "bg-acid/90 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.35)]" : "text-mute hover:text-paper"
                }`}
              >
                {String(d).slice(2)}s
              </button>
            );
          })}
        </div>
      </div>

      {genres.length > 1 && (
        <select
          value=""
          onChange={(e) => e.target.value && set({ ...f, genres: [...new Set([...f.genres, e.target.value])] })}
          className="field cursor-pointer text-mute"
        >
          <option value="">Genre…</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      )}
      <AnimatePresence>
        {f.genres.map((g) => (
          <motion.button
            key={g}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => set({ ...f, genres: f.genres.filter((x) => x !== g) })}
            className="btn btn-on rounded-full px-2.5"
          >
            {g} <span className="opacity-60">×</span>
          </motion.button>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {filtersActive(f) && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => set(EMPTY_FILTERS)}
            className="ml-auto text-[12px] text-mute transition-colors hover:text-paper"
          >
            Clear filters
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
