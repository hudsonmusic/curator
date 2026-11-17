"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Marker, Section } from "@/lib/types";
import { rngFrom } from "@/lib/rng";

interface Props {
  peaks?: number[];
  /** Used to draw a stable placeholder while the real waveform loads (or for full songs). */
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

/** The element's width in CSS pixels, kept up to date. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Resamples peaks to n bars (loudest in each slice), smoothed a touch and normalised. */
function resample(peaks: number[], n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i / n) * peaks.length);
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
    let m = 0;
    for (let j = a; j < b; j++) m = Math.max(m, peaks[j]);
    out.push(m);
  }
  // Stretch quiet-to-loud across the full height (dense, loud records otherwise look flat).
  const sorted = [...out].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const hi = Math.max(sorted[sorted.length - 1] ?? 1, lo + 1e-6);
  return out.map((v, i) => {
    const prev = out[i - 1] ?? v, next = out[i + 1] ?? v;
    const x = Math.min(1, Math.max(0, (v * 0.6 + (prev + next) * 0.2 - lo) / (hi - lo)));
    return 0.14 + 0.86 * Math.pow(x, 1.5);
  });
}

/** A song-shaped placeholder: smooth, with a quiet intro and outro, stable per song. */
function placeholder(seed: string, n: number): number[] {
  const rng = rngFrom(seed);
  const raw = Array.from({ length: n }, () => rng());
  return raw.map((_, i) => {
    let s = 0, c = 0;
    for (let k = -3; k <= 3; k++) {
      const v = raw[i + k];
      if (v === undefined) continue;
      s += v;
      c++;
    }
    const x = i / Math.max(1, n - 1);
    const shape = Math.min(1, x * 8, (1 - x) * 10);
    return 0.18 + 0.62 * (s / c) * (0.55 + 0.45 * shape);
  });
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function Waveform({ peaks, seed, progress, duration, sections, markers, loop, onSeek, compact, loading }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");

  // Bars sized in real pixels so they stay crisp at any width.
  const bar = compact ? 2 : 3;
  const gap = compact ? 1.5 : 2;
  const n = Math.max(12, Math.floor((width + gap) / (bar + gap)));
  const real = !!peaks?.length;
  const bars = useMemo(() => (real ? resample(peaks!, n) : placeholder(seed, n)), [real, peaks, seed, n]);

  // Animate in once per song, not on every redraw.
  const [shown, setShown] = useState<string | null>(null);
  const key = `${seed}:${real}`;
  useEffect(() => {
    const t = setTimeout(() => setShown(key), 20);
    return () => clearTimeout(t);
  }, [key]);
  const entering = shown !== key;

  const H = 100;
  const W = n * (bar + gap) - gap;
  const p = Math.min(1, Math.max(0, progress || 0));
  const d = duration || 0;
  const fraction = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const shapes = bars.map((v, i) => {
    const h = Math.max(compact ? 10 : 6, v * 96);
    return <rect key={i} x={i * (bar + gap)} y={(H - h) / 2} width={bar} height={h} rx={bar / 2} />;
  });

  return (
    <div
      ref={ref}
      className={`group/wave relative size-full select-none ${onSeek ? "cursor-pointer" : ""}`}
      onPointerMove={(e) => setHover(fraction(e.clientX, e.currentTarget))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => onSeek?.(fraction(e.clientX, e.currentTarget))}
    >
      {width > 0 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="size-full overflow-visible transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ opacity: entering ? 0 : 1, transform: entering ? "scaleY(0.4)" : "none" }}
          aria-hidden
        >
          <defs>
            <clipPath id={`${id}-played`}>
              <rect x={0} y={-10} width={W * p} height={H + 20} />
            </clipPath>
            <clipPath id={`${id}-hover`}>
              <rect x={0} y={-10} width={hover !== null ? W * hover : 0} height={H + 20} />
            </clipPath>
            <linearGradient id={`${id}-grad`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" style={{ stopColor: "var(--color-accent)" }} />
              <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--color-accent) 55%, white)" }} />
            </linearGradient>
          </defs>

          {d > 0 &&
            sections?.map((s, i) => (
              <rect
                key={i}
                x={(s.start / d) * W}
                y={2}
                width={((s.end - s.start) / d) * W}
                height={H - 4}
                rx={4}
                className={loop && loop.start === s.start ? "fill-accent/25" : "fill-accent/10"}
              />
            ))}

          {/* Unplayed, then the hover preview, then the played part (cut smoothly, not bar by bar). */}
          <g className={real ? "fill-white/25" : `fill-white/[0.13] ${loading ? "animate-pulse" : ""}`}>{shapes}</g>
          {hover !== null && hover > p && (
            <g clipPath={`url(#${id}-hover)`} className="fill-white/40">
              {shapes}
            </g>
          )}
          <g clipPath={`url(#${id}-played)`} fill={`url(#${id}-grad)`} opacity={real ? 1 : 0.85}>
            {shapes}
          </g>

          {d > 0 &&
            markers?.map((m) => (
              <line
                key={`${m.src}${m.t}`}
                x1={(m.t / d) * W}
                x2={(m.t / d) * W}
                y1={-4}
                y2={H + 4}
                className="stroke-accent"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </svg>
      )}

      {/* Playhead */}
      {p > 0 && p < 1 && (
        <div
          className="pointer-events-none absolute inset-y-[8%] w-[2px] -translate-x-1/2 rounded-full bg-paper shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]"
          style={{ left: `${p * 100}%` }}
        />
      )}
      {hover !== null && onSeek && d > 0 && (
        <div
          className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-paper shadow-lg"
          style={{ left: `${hover * 100}%` }}
        >
          {fmt(hover * d)}
        </div>
      )}
    </div>
  );
}
