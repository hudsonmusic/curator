"use client";

import type { SampleType } from "@/lib/types";
import { EMPTY_FILTERS, filtersActive, type Filters } from "./meta";

const TYPES: { id: "all" | SampleType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "song", label: "Songs" },
  { id: "acapella", label: "Acapellas" },
  { id: "loop", label: "Loops" },
];
const DECADES = [1960, 1970, 1980, 1990, 2000, 2010];
const CAMELOT = Array.from({ length: 12 }, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat();

const seg = (on: boolean) =>
  `px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${on ? "bg-paper text-ink" : "text-mute hover:text-paper"}`;

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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2.5">
      <div className="flex overflow-hidden rounded-md border border-line">
        {TYPES.filter((t) => t.id !== "loop" || loopsAvailable).map((t) => (
          <button key={t.id} onClick={() => set({ ...f, type: t.id })} className={seg(f.type === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-mute">
        BPM
        <input
          value={f.bpmLo ?? ""}
          onChange={(e) => set({ ...f, bpmLo: num(e.target.value) })}
          placeholder="min"
          inputMode="numeric"
          className="w-12 rounded border border-line bg-transparent px-1.5 py-1 text-center text-paper outline-none placeholder:text-mute/50 focus:border-acid"
        />
        –
        <input
          value={f.bpmHi ?? ""}
          onChange={(e) => set({ ...f, bpmHi: num(e.target.value) })}
          placeholder="max"
          inputMode="numeric"
          className="w-12 rounded border border-line bg-transparent px-1.5 py-1 text-center text-paper outline-none placeholder:text-mute/50 focus:border-acid"
        />
        <button
          onClick={() => set({ ...f, halfDouble: !f.halfDouble })}
          title="Also match half and double time"
          className={`rounded border px-1.5 py-1 ${f.halfDouble ? "border-acid text-acid" : "border-line"}`}
        >
          ½×2
        </button>
      </label>

      <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-mute">
        Key
        <select
          value={f.key ?? ""}
          onChange={(e) => set({ ...f, key: e.target.value || null })}
          className="rounded border border-line bg-ink px-1.5 py-1 text-paper outline-none focus:border-acid"
        >
          <option value="">any</option>
          {CAMELOT.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {f.key && (
          <button
            onClick={() => set({ ...f, keyMode: f.keyMode === "exact" ? "compatible" : "exact" })}
            className="rounded border border-line px-1.5 py-1 hover:text-paper"
            title="Exact key, or keys that mix harmonically"
          >
            {f.keyMode === "exact" ? "exact" : "+ compatible"}
          </button>
        )}
      </label>

      <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-mute">
        {DECADES.map((d) => {
          const on = f.decades.includes(d);
          return (
            <button
              key={d}
              onClick={() => set({ ...f, decades: on ? f.decades.filter((x) => x !== d) : [...f.decades, d] })}
              className={`rounded border px-1.5 py-1 ${on ? "border-paper bg-paper text-ink" : "border-line hover:text-paper"}`}
            >
              {String(d).slice(2)}s
            </button>
          );
        })}
      </div>

      {genres.length > 1 && (
        <select
          value=""
          onChange={(e) => e.target.value && set({ ...f, genres: [...new Set([...f.genres, e.target.value])] })}
          className="rounded border border-line bg-ink px-1.5 py-1 font-mono text-[11px] uppercase tracking-wider text-mute outline-none focus:border-acid"
        >
          <option value="">+ genre</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      )}
      {f.genres.map((g) => (
        <button
          key={g}
          onClick={() => set({ ...f, genres: f.genres.filter((x) => x !== g) })}
          className="rounded border border-paper bg-paper px-1.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink"
        >
          {g} ×
        </button>
      ))}

      {filtersActive(f) && (
        <button onClick={() => set(EMPTY_FILTERS)} className="ml-auto font-mono text-[11px] uppercase tracking-wider text-mute hover:text-paper">
          clear
        </button>
      )}
    </div>
  );
}
