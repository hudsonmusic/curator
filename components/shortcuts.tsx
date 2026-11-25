"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Anywhere",
    keys: [
      ["/", "Search"],
      ["R", "Next random pick"],
      ["?", "Show these shortcuts"],
    ],
  },
  {
    title: "In a list",
    keys: [
      ["↑ ↓", "Move and play"],
      ["Space", "Play or pause"],
      ["↵", "Details"],
      ["S", "Save"],
      ["A", "Save for Ableton (with the helper)"],
    ],
  },
  {
    title: "In details",
    keys: [
      ["M", "Mark a sample point"],
      ["Esc", "Close"],
    ],
  },
  {
    title: "Radio",
    keys: [
      ["← →", "Previous / next"],
      ["Esc", "Close"],
    ],
  },
];

/** The ? button in the header: every keyboard shortcut in one place. Also opens with ?. */
export function ShortcutsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?") setOpen((o) => !o);
      else if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, []);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        aria-expanded={open}
        className={`grid size-8 place-items-center rounded-lg text-[13px] font-semibold transition-colors hover:bg-white/[0.08] hover:text-paper ${open ? "bg-white/[0.08] text-paper" : "text-mute"}`}
      >
        ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-white/[0.1] bg-[rgb(24_24_27/0.97)] p-3 shadow-[0_20px_60px_rgb(0_0_0/0.55)]"
          >
            <div className="mb-2 text-[13px] font-semibold">Keyboard shortcuts</div>
            <div className="space-y-3">
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="label mb-1">{g.title}</div>
                  {g.keys.map(([k, v]) => (
                    <div key={k + v} className="flex items-center justify-between gap-3 py-0.5 text-[12px]">
                      <span className="text-paper/85">{v}</span>
                      <kbd className="shrink-0 rounded bg-white/[0.08] px-1.5 font-mono text-[10px] text-mute">{k}</kbd>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
