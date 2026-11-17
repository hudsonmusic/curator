"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/lib/types";

export interface ServiceLink {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
}

const q = (t: Track) => `${t.artist} ${t.title.replace(/\s*[([].*?[)\]]/g, "")}`.trim();
const enc = encodeURIComponent;

const Icon = ({ bg, children }: { bg: string; children: ReactNode }) => (
  <span className="grid size-5 shrink-0 place-items-center rounded-[5px] text-white" style={{ background: bg }}>
    <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
      {children}
    </svg>
  </span>
);

/** Where a track can be opened. Direct links when we have them, otherwise a search on that service. */
export function serviceLinks(t: Track): ServiceLink[] {
  const query = q(t);
  return [
    {
      id: "youtube",
      label: "YouTube",
      href: `https://www.youtube.com/results?search_query=${enc(query)}`,
      icon: <Icon bg="#ff0033"><path d="M6 4.5v7l6-3.5z" /></Icon>,
    },
    {
      id: "spotify",
      label: "Spotify",
      href: `https://open.spotify.com/search/${enc(query)}`,
      icon: (
        <Icon bg="#1db954">
          <path d="M3.5 6.2c3-1 6.4-.7 9 .8M4 8.5c2.5-.7 5.2-.5 7.3.7M4.6 10.7c2-.5 4-.3 5.6.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </Icon>
      ),
    },
    {
      id: "apple",
      label: "Apple Music",
      href: t.source === "itunes" && t.pageUrl ? t.pageUrl : `https://music.apple.com/us/search?term=${enc(query)}`,
      icon: <Icon bg="#fa2d48"><path d="M11.5 2.5v7.2a1.8 1.8 0 1 1-1.2-1.7V5L6.5 5.9v5.3a1.8 1.8 0 1 1-1.2-1.7V4.2z" /></Icon>,
    },
    {
      id: "soundcloud",
      label: "SoundCloud",
      href: t.source === "soundcloud" && t.pageUrl ? t.pageUrl : `https://soundcloud.com/search/sounds?q=${enc(query)}`,
      icon: <Icon bg="#ff5500"><path d="M2 10.5h1V8H2zm1.7 0h1V7h-1zm1.7 0h1V6.3h-1zm1.7 0h4.4a2 2 0 0 0 .2-4A3 3 0 0 0 7.1 5z" /></Icon>,
    },
    {
      id: "beatport",
      label: "Beatport",
      href: `https://www.beatport.com/search?q=${enc(query)}`,
      icon: (
        <Icon bg="#01ff95">
          <path d="M6.2 3v6.2a2.6 2.6 0 1 0 2.6-2.6H7.5" stroke="#111" strokeWidth="1.7" strokeLinecap="round" fill="none" />
        </Icon>
      ),
    },
    {
      id: "discogs",
      label: "Discogs",
      href: `https://www.discogs.com/search/?q=${enc(query)}&type=all`,
      icon: <Icon bg="#333"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="1.3" /></Icon>,
    },
    {
      id: "whosampled",
      label: "WhoSampled",
      href: `https://www.whosampled.com/search/?q=${enc(query)}`,
      icon: <Icon bg="#c7962c"><path d="M3 5h10M3 8h7M3 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></Icon>,
    },
    {
      id: "web",
      label: "Search the web",
      href: `https://www.google.com/search?q=${enc(`${query} song`)}`,
      icon: <Icon bg="#5a5a60"><circle cx="7" cy="7" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></Icon>,
    },
  ];
}

/** Small "open in…" button with a menu of services. */
export function OpenIn({ track, className = "" }: { track: Track; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const up = r.bottom + 340 > window.innerHeight;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, r.right - 200), up });
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

  return (
    <>
      <button
        ref={btn}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label="Open in…"
        title="Open in YouTube, Spotify, Apple Music…"
        className={`grid size-6 place-items-center rounded-md transition-colors hover:bg-white/[0.1] hover:text-paper ${open ? "bg-white/[0.1] text-paper" : "text-mute"} ${className}`}
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 3h4v4M13 3L7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
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
                className="glass-strong z-[60] w-[200px] rounded-xl border border-white/[0.1] p-1 shadow-[0_16px_40px_rgb(0_0_0/0.55)]"
              >
                <div className="truncate px-2 pb-1 pt-1.5 text-[11px] text-mute">Open “{track.title}” in</div>
                {serviceLinks(track).map((l) => (
                  <a
                    key={l.id}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-paper/90 transition-colors hover:bg-accent hover:text-onaccent ${
                      l.id === "web" ? "mt-1 border-t border-line pt-2" : ""
                    }`}
                  >
                    {l.icon}
                    <span className="flex-1">{l.label}</span>
                    <span className="text-[11px] opacity-50">↗</span>
                  </a>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
