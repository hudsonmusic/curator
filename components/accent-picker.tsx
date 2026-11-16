"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useProfile } from "@/lib/profile";
import { ACCENTS } from "@/lib/theme";

/** Toolbar button that opens a macOS-style accent colour picker. */
export function AccentPicker() {
  const { profile, update } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const set = (hex: string) => update({ accent: hex });
  const isPreset = ACCENTS.some((a) => a.hex.toLowerCase() === profile.accent.toLowerCase());

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-white/[0.08]"
        title="Accent colour"
        aria-label="Accent colour"
      >
        <span className="size-4 rounded-full bg-accent shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25)]" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            style={{ transformOrigin: "top right" }}
            className="glass-strong absolute right-0 top-10 z-50 w-60 rounded-xl border border-white/[0.1] p-3 shadow-[0_20px_50px_rgb(0_0_0/0.55)]"
          >
            <div className="label mb-2.5">Accent colour</div>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => {
                const on = a.hex.toLowerCase() === profile.accent.toLowerCase();
                return (
                  <button
                    key={a.hex}
                    onClick={() => set(a.hex)}
                    title={a.name}
                    aria-label={a.name}
                    className="relative grid size-6 place-items-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95"
                    style={{ background: a.hex }}
                  >
                    {on && <motion.span layoutId="accent-on" className="size-2 rounded-full bg-white shadow" />}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg bg-white/[0.05] px-2.5 py-2 text-[12px] transition-colors hover:bg-white/[0.08]">
              <span>Custom…</span>
              <span className="flex items-center gap-2 font-mono text-[11px] text-mute">
                {!isPreset && profile.accent}
                <span className="relative size-5 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25)]" style={{ background: profile.accent }}>
                  <input
                    type="color"
                    value={profile.accent}
                    onChange={(e) => set(e.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    aria-label="Custom colour"
                  />
                </span>
              </span>
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
