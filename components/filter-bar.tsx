"use client";

import { useEffect, useState } from "react";
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
  // The detailed filters live behind a button; what's switched on shows as chips.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN) === "1");
    } catch {}
  }, []);
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN, o ? "0" : "1");
      } catch {}
      return !o;
    });
  const chips = activeChips(f, set);
  return (
    <div className="px-4 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={f.type} options={TYPES.filter((t) => t.id !== "loop" || loopsAvailable)} onChange={(type) => set({ ...f, type })} />
        <button onClick={toggle} aria-expanded={open} className={`btn ${open ? "btn-on" : ""}`} title="BPM, key, era and genre">
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M2 4h12M4.5 8h7M7 12h2" />
          </svg>
          Filters
          {chips.length > 0 && !open && (
            <span className="grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-onaccent">{chips.length}</span>
          )}
        </button>
        {!open && (
          <AnimatePresence initial={false}>
            {chips.map((c) => (
              <motion.button
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                onClick={c.clear}
                title="Remove this filter"
                className="btn btn-on rounded-full px-2.5"
              >
                {c.label} <span className="opacity-60">×</span>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
        {filtersActive(f) && (
          <button onClick={() => set(EMPTY_FILTERS)} className="ml-auto text-[12px] text-mute transition-colors hover:text-paper">
            Clear
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="more"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5">
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
                  on ? "bg-accent/90 text-onaccent shadow-[0_1px_2px_rgb(0_0_0/0.35)]" : "text-mute hover:text-paper"
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

    </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const OPEN = "curator:filters-open";

/** One removable chip per filter that's on. */
function activeChips(f: Filters, set: (f: Filters) => void) {
  const out: { id: string; label: string; clear: () => void }[] = [];
  if (f.bpmLo !== null || f.bpmHi !== null) {
    const label = f.bpmLo !== null && f.bpmHi !== null ? `${f.bpmLo}–${f.bpmHi} BPM` : f.bpmLo !== null ? `${f.bpmLo}+ BPM` : `≤${f.bpmHi} BPM`;
    out.push({ id: "bpm", label, clear: () => set({ ...f, bpmLo: null, bpmHi: null }) });
  }
  if (f.key) out.push({ id: "key", label: f.keyMode === "exact" ? `Key ${f.key}` : `Mixes with ${f.key}`, clear: () => set({ ...f, key: null }) });
  for (const d of f.decades) out.push({ id: `d${d}`, label: `${String(d).slice(2)}s`, clear: () => set({ ...f, decades: f.decades.filter((x) => x !== d) }) });
  for (const g of f.genres) out.push({ id: `g${g}`, label: g, clear: () => set({ ...f, genres: f.genres.filter((x) => x !== g) }) });
  return out;
}
