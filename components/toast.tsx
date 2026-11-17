"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EVENT = "curator:toast";

/** Shows a short message at the top of the screen. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setMsg({ id: Date.now(), text: (e as CustomEvent<string>).detail });
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(id);
  }, [msg]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[70] flex justify-center px-4">
      <AnimatePresence>
        {msg && (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            role="status"
            className="glass-strong rounded-full border border-white/[0.1] px-4 py-2 text-[13px] shadow-[0_12px_32px_rgb(0_0_0/0.5)]"
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
