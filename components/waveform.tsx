"use client";

import { useMemo, useState } from "react";
import type { Marker, Section } from "@/lib/types";
import { rngFrom } from "@/lib/rng";

interface Props {
  peaks?: number[];
  /** Used to draw a stable placeholder while the real waveform loads. */
  seed: string;
  progress: number;
  duration?: number;
  sections?: Section[];
  markers?: Marker[];
  loop?: Section | null;
  onSeek?: (fraction: number) => void;
  compact?: boolean;
  loading?: boolean;
}

export function Waveform({ peaks, seed, progress, duration, sections, markers, loop, onSeek, compact, loading }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const bars = useMemo(() => {
    const n = compact ? 90 : 140;
    if (peaks?.length) {
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = Math.floor((i / n) * peaks.length);
        const b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
        out.push(Math.max(...peaks.slice(a, b)));
      }
      return out;
    }
    const rng = rngFrom(seed);
    return Array.from({ length: n }, (_, i) => 0.25 + 0.5 * rng() * (0.6 + 0.4 * Math.sin(i / 7)));
  }, [peaks, seed, compact]);

  const real = !!peaks?.length;
  const W = bars.length * 4;
  const d = duration || 0;

  return (
    <div
      className={`relative size-full select-none ${onSeek ? "cursor-pointer" : ""}`}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setHover((e.clientX - r.left) / r.width);
      }}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
      }}
    >
      <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" className="size-full overflow-visible">
        {d > 0 &&
          sections?.map((s, i) => (
            <rect
              key={i}
              x={(s.start / d) * W}
              y={0}
              width={((s.end - s.start) / d) * W}
              height={100}
              className={loop && loop.start === s.start ? "fill-acid/25" : "fill-acid/10"}
              rx={3}
            />
          ))}
        {bars.map((v, i) => {
          const h = Math.max(4, v * 92);
          const played = i / bars.length < progress;
          return (
            <rect
              key={i}
              x={i * 4 + 0.5}
              y={50 - h / 2}
              width={2.6}
              height={h}
              rx={1.3}
              className={`wave-bar ${real ? "" : loading ? "animate-pulse" : ""} ${
                played ? "fill-paper" : real ? "fill-mute/45" : "fill-mute/20"
              }`}
              style={{ animationDelay: real ? `${i * 4}ms` : undefined }}
            />
          );
        })}
        {d > 0 &&
          markers?.map((m) => (
            <line
              key={`${m.src}${m.t}`}
              x1={(m.t / d) * W}
              x2={(m.t / d) * W}
              y1={-4}
              y2={104}
              className="stroke-acid"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>
      {hover !== null && onSeek && (
        <div className="pointer-events-none absolute inset-y-0 w-px bg-paper/50" style={{ left: `${hover * 100}%` }} />
      )}
    </div>
  );
}
