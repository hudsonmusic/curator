"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EXAMPLES = [
  "dusty 70s soul with female vocals around 95 BPM",
  "obscure early 90s jazzy hip hop with rhodes",
  "soulful house acapellas",
  "dreamy 60s bossa nova",
  "dark minimal techno, 124–128 bpm",
  "rap acapellas around 90 bpm",
  "roots reggae and dub with horns",
  "uplifting disco strings, late 70s",
];

const RECENT = "curator:magic-recent";

export function MagicIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <path d="M8.5 2.5l1.3 3.6 3.7 1.4-3.7 1.4-1.3 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" />
      <path d="M15 10.5l.7 1.9 1.8.6-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.6z" opacity=".75" />
      <path d="M13.2 2l.5 1.2 1.2.5-1.2.4-.5 1.3-.5-1.3-1.2-.4 1.2-.5z" opacity=".6" />
    </svg>
  );
}

/** The ✨ button in the search bar. */
export function MagicButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Magic search"
      title="Magic search: describe the songs or acapellas you want"
      className={`grid size-6 place-items-center rounded-md text-accent transition-[background-color,transform] hover:scale-110 hover:bg-accent/15 ${className}`}
    >
      <MagicIcon className="size-4" />
    </button>
  );
}

/** Describe what you want in your own words; curator digs for it. */
export function MagicDialog({
  open,
  onClose,
  onSearch,
  ai,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: (text: string) => void;
  ai: boolean;
}) {
  const [text, setText] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT) ?? "[]"));
    } catch {}
    setTimeout(() => ref.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const go = (q: string) => {
    const v = q.trim();
    if (!v) return;
    const next = [v, ...recent.filter((r) => r !== v)].slice(0, 6);
    try {
      localStorage.setItem(RECENT, JSON.stringify(next));
    } catch {}
    setText("");
    onSearch(v);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="magic-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
          />
          <motion.div
            key="magic"
            role="dialog"
            aria-label="Magic search"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="glass-strong fixed left-1/2 top-[12vh] z-[61] !bg-menu w-[min(620px,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_30px_80px_rgb(0_0_0/0.6)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(30rem_6rem_at_50%_0%,color-mix(in_srgb,var(--color-accent)_28%,transparent),transparent)]" />
            <div className="relative p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <MagicIcon className="size-4 text-accent" />
                Magic search
                <span className="ml-auto text-[11px] font-normal text-mute">{ai ? "Read by Claude" : "Describe it in your own words"}</span>
              </div>
              <textarea
                ref={ref}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    go(text);
                  }
                }}
                rows={3}
                maxLength={400}
                placeholder="What are you digging for? Genre, era, mood, tempo, key, vocals, instruments, artists it should sound like…"
                className="field mt-3 w-full resize-none rounded-xl p-3 text-[14px] leading-relaxed"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-mute">Say “acapellas” for vocals only. Enter to dig.</span>
                <button onClick={() => go(text)} disabled={!text.trim()} className="btn btn-on rounded-full px-4">
                  <MagicIcon className="size-3.5" />
                  Dig
                </button>
              </div>
              <div className="mt-4">
                <div className="label mb-1.5">{recent.length ? "Recent" : "Try"}</div>
                <div className="flex flex-wrap gap-1.5">
                  {(recent.length ? [...recent, ...EXAMPLES.slice(0, 3)] : EXAMPLES).slice(0, 8).map((ex) => (
                    <button
                      key={ex}
                      onClick={() => go(ex)}
                      className="rounded-full bg-white/[0.07] px-3 py-1 text-left text-[12px] text-paper/85 transition-colors hover:bg-accent hover:text-onaccent"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
