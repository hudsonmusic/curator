"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Big serif headline that rises in word by word. */
export function Headline({ children, className = "" }: { children: string; className?: string }) {
  return (
    <h1 className={`font-display leading-[0.95] tracking-tight ${className}`}>
      {children.split(" ").map((w, i) => (
        <span key={i} className="rise mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span style={{ animationDelay: `${i * 70}ms` }}>{w}</span>
        </span>
      ))}
    </h1>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active ? "border-paper bg-paper text-ink" : "border-line text-mute hover:border-mute hover:text-paper"
      }`}
    >
      {children}
    </motion.button>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{children}</div>;
}
