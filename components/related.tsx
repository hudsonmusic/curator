"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { RelatedBy, RelatedQuery, Track } from "@/lib/types";
import { metaOf } from "./meta";

const EVENT = "curator:related";

/** Opens the related-songs view (the dashboard listens for this). */
export function openRelated(q: RelatedQuery) {
  window.dispatchEvent(new CustomEvent<RelatedQuery>(EVENT, { detail: q }));
}

export function onRelated(fn: (q: RelatedQuery) => void) {
  const h = (e: Event) => fn((e as CustomEvent<RelatedQuery>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

/** "Like this song" from a track, carrying its current BPM/key for the filters. */
export function relatedTo(track: Track, matchKey = false) {
  openRelated({ by: "style", value: track.title, track, matchKey });
}

const PIVOT_HINT: Record<RelatedBy, string> = {
  style: "Find similar songs",
  label: "More from this label",
  genre: "More in this genre",
  year: "More from this year",
  bpm: "Songs at this BPM",
  key: "Songs that mix with this key",
  artist: "More by this artist",
};

/** Any clickable attribute (label, genre, year, BPM, key) that finds songs sharing it. */
export function Pivot({
  by,
  value,
  track,
  children,
  className = "",
  onDone,
}: {
  by: RelatedBy;
  value: string | number | undefined;
  track?: Track;
  children: ReactNode;
  className?: string;
  onDone?: () => void;
}) {
  if (value === undefined || value === "" || value === "—") return <span className={className}>{children}</span>;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openRelated({ by, value: String(value), track });
        onDone?.();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      title={PIVOT_HINT[by]}
      className={`truncate text-left underline-offset-2 transition-colors hover:text-accent hover:underline ${className}`}
    >
      {children}
    </button>
  );
}

/** The ≈ button beside each song: similar songs, optionally in a compatible key. */
export function RelatedButton({ track, className = "" }: { track: Track; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const up = r.bottom + 200 > window.innerHeight;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, r.right - 232), up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "mousedown" && (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const m = metaOf(track);
  const items: { label: string; sub: string; go: () => void; disabled?: boolean }[] = [
    {
      label: "Similar songs",
      sub: [m.bpm ? `~${Math.round(m.bpm)} BPM` : "BPM", track.genre ?? "style", track.year ? `${Math.floor(track.year / 10) * 10}s` : "era"].join(" · "),
      go: () => relatedTo(track, false),
    },
    {
      label: "Similar + same key",
      sub: m.cam ? `Mixes with ${m.cam}${m.key ? ` (${m.key})` : ""}` : "Key not read yet",
      go: () => relatedTo(track, true),
      disabled: !m.cam,
    },
  ];

  return (
    <>
      <button
        ref={btn}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label="Find related songs"
        title="Find related songs"
        className={`grid size-6 place-items-center rounded-md transition-colors hover:bg-white/[0.1] hover:text-paper ${open ? "bg-white/[0.1] text-paper" : "text-mute"} ${className}`}
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <circle cx="4" cy="8" r="2" />
          <circle cx="12" cy="4" r="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M5.8 7.1l4.4-2.2M5.8 8.9l4.4 2.2" />
        </svg>
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={menu}
                initial={{ opacity: 0, scale: 0.96, y: pos.up ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 600, damping: 36 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  left: pos.left,
                  ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
                  transformOrigin: pos.up ? "bottom right" : "top right",
                }}
                className="glass-strong z-[60] w-[232px] rounded-xl border border-white/[0.1] p-1 shadow-[0_16px_40px_rgb(0_0_0/0.55)]"
              >
                <div className="truncate px-2 pb-1 pt-1.5 text-[11px] text-mute">Find songs like “{track.title}”</div>
                {items.map((it) => (
                  <button
                    key={it.label}
                    disabled={it.disabled}
                    onClick={() => {
                      setOpen(false);
                      it.go();
                    }}
                    className="group/item flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-accent enabled:hover:text-onaccent disabled:opacity-40"
                  >
                    <span className="text-[13px]">{it.label}</span>
                    <span className="text-[11px] opacity-60">{it.sub}</span>
                  </button>
                ))}
                <div className="mx-2 mt-1 border-t border-line pt-1.5 pb-1 text-[11px] leading-snug text-mute">
                  Known records plus deep cuts. Click any label, genre, year, BPM or key to pivot on it.
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
