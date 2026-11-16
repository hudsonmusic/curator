"use client";

import type { Track } from "@/lib/types";
import { hashString } from "@/lib/rng";

const GLYPH: Record<string, string> = { acapella: "vox", loop: "loop", song: "♪" };

/** Album art, or a generated cover for sources without art. */
export function Artwork({ track, big = false }: { track: Track; big?: boolean }) {
  if (track.artwork) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={track.artwork} alt="" className="size-full object-cover" loading="lazy" draggable={false} />;
  }
  const h = hashString(track.id);
  const hue = h % 360;
  const angle = (h >> 8) % 360;
  return (
    <div
      className="relative grid size-full place-items-center overflow-hidden"
      style={{
        background: `linear-gradient(${angle}deg, hsl(${hue} 30% 16%), hsl(${(hue + 40) % 360} 40% 8%))`,
      }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(circle at ${30 + (h % 40)}% ${30 + ((h >> 4) % 40)}%, hsl(${hue} 70% 55% / 0.35), transparent 55%)`,
        }}
      />
      <span className={`relative font-mono text-paper/70 ${big ? "text-2xl" : "text-[10px]"}`}>
        {GLYPH[track.type]}
      </span>
    </div>
  );
}
