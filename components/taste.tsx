"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { SampleType } from "@/lib/types";
import { SCENES } from "@/lib/scenes";
import { useProfile, type Reference } from "@/lib/profile";
import { analyzeFile } from "@/lib/analysis-store";
import { useConfig } from "@/lib/config";

export function SceneChooser() {
  const { profile, update } = useProfile();
  const toggle = (id: string) =>
    update((p) => ({ scenes: p.scenes.includes(id) ? p.scenes.filter((s) => s !== id) : [...p.scenes, id] }));
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {SCENES.map((s, i) => {
        const on = profile.scenes.includes(s.id);
        return (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.035 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => toggle(s.id)}
            className={`relative overflow-hidden rounded-xl border p-4 text-left transition-colors ${
              on ? "border-acid bg-acid/[0.06]" : "border-line hover:border-mute"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-display text-2xl leading-tight">{s.name}</div>
              <span className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${on ? "border-acid bg-acid" : "border-line"}`}>
                <AnimatePresence>
                  {on && (
                    <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} viewBox="0 0 16 16" className="size-3 text-ink" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3.5 8.5l3 3 6-7" />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </span>
            </div>
            <div className="mt-1 text-sm text-mute">{s.blurb}</div>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-mute">
              {s.years[0]}–{s.years[1]} · {s.artists.slice(0, 3).join(", ")}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

const TYPES: { id: SampleType; label: string; blurb: string }[] = [
  { id: "song", label: "Songs to chop", blurb: "Records with synth, keys and instrument loops" },
  { id: "acapella", label: "Acapellas", blurb: "Isolated vocals and vocal phrases" },
  { id: "loop", label: "Loops", blurb: "Short melodic loops, ready to drop in" },
];

export function TypeAndTempo() {
  const { profile, update } = useProfile();
  const config = useConfig();
  const toggle = (t: SampleType) =>
    update((p) => {
      const next = p.types.includes(t) ? p.types.filter((x) => x !== t) : [...p.types, t];
      return next.length ? { types: next } : {};
    });
  return (
    <div className="space-y-10">
      <div className="grid gap-2 sm:grid-cols-3">
        {TYPES.map((t) => {
          const on = profile.types.includes(t.id);
          const needsKey = t.id === "loop" && config && !config.freesound;
          return (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => toggle(t.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${on ? "border-acid bg-acid/[0.06]" : "border-line hover:border-mute"}`}
            >
              <div className="font-display text-2xl">{t.label}</div>
              <div className="mt-1 text-sm text-mute">{t.blurb}</div>
              {needsKey && <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-mute">needs a Freesound key</div>}
            </motion.button>
          );
        })}
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm">Tempo you play</span>
            <span className="font-mono text-sm text-acid">
              {profile.bpmMin}–{profile.bpmMax} bpm
            </span>
          </div>
          <RangeSlider
            min={60}
            max={180}
            lo={profile.bpmMin}
            hi={profile.bpmMax}
            onChange={(lo, hi) => update({ bpmMin: lo, bpmMax: hi })}
          />
          <p className="mt-2 text-xs text-mute">Tracks in range (counting half and double time) get their BPM highlighted.</p>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm">Project tempo</span>
            <span className="font-mono text-sm text-acid">{profile.projectBpm} bpm</span>
          </div>
          <input
            type="range"
            min={60}
            max={180}
            value={profile.projectBpm}
            onChange={(e) => update({ projectBpm: +e.target.value })}
            className="mt-4 w-full accent-[var(--color-acid)]"
          />
          <p className="mt-2 text-xs text-mute">“Sync” in the player speeds previews to this tempo, like a turntable pitch fader.</p>
        </div>
      </div>
    </div>
  );
}

function RangeSlider({ min, max, lo, hi, onChange }: { min: number; max: number; lo: number; hi: number; onChange: (lo: number, hi: number) => void }) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="relative mt-4 h-5">
      <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-line" />
      <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded bg-acid" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
      {[lo, hi].map((v, i) => (
        <input
          key={i}
          type="range"
          min={min}
          max={max}
          value={v}
          onChange={(e) => {
            const n = +e.target.value;
            if (i === 0) onChange(Math.min(n, hi - 4), hi);
            else onChange(lo, Math.max(n, lo + 4));
          }}
          className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-paper [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-paper"
          aria-label={i === 0 ? "Minimum BPM" : "Maximum BPM"}
        />
      ))}
    </div>
  );
}

export function References() {
  const { profile, update } = useProfile();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);

  const add = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|aiff?|m4a|flac|ogg)$/i.test(f.name)).slice(0, 5);
    for (const f of list) {
      const name = f.name.replace(/\.[^.]+$/, "");
      setBusy((b) => [...b, name]);
      try {
        const a = await analyzeFile(f);
        const ref: Reference = { name, bpm: Math.round(a.bpm), key: a.key, camelot: a.camelot };
        update((p) => ({ references: [...p.references.filter((r) => r.name !== name), ref].slice(-8) }));
      } catch {
        // Unsupported file; skip it.
      } finally {
        setBusy((b) => b.filter((x) => x !== name));
      }
    }
  };

  return (
    <div>
      <button
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void add(e.dataTransfer.files);
        }}
        className={`grid w-full place-items-center rounded-2xl border border-dashed px-6 py-12 text-center transition-colors ${
          drag ? "border-acid bg-acid/[0.05]" : "border-line hover:border-mute"
        }`}
      >
        <div className="font-display text-3xl italic">Drop your own tracks here</div>
        <div className="mt-2 text-sm text-mute">Up to 5 files. Analysed in your browser and never uploaded.</div>
      </button>
      <input ref={input} type="file" accept="audio/*" multiple hidden onChange={(e) => e.target.files && add(e.target.files)} />
      <div className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {busy.map((n) => (
            <motion.div key={"b" + n} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex justify-between rounded-lg border border-line px-4 py-3 text-sm">
              <span className="truncate">{n}</span>
              <span className="animate-pulse font-mono text-xs text-mute">listening…</span>
            </motion.div>
          ))}
          {profile.references.map((r) => (
            <motion.div key={r.name} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="flex shrink-0 items-center gap-3 font-mono text-xs text-mute">
                <span className="text-paper">{r.bpm} bpm</span>
                <span className="text-paper">
                  {r.key} · {r.camelot}
                </span>
                <button onClick={() => update({ references: profile.references.filter((x) => x.name !== r.name) })} className="hover:text-paper">
                  ×
                </button>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
