"use client";

import { motion } from "framer-motion";
import { useId } from "react";

/** macOS-style segmented control with a sliding highlight. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex rounded-lg bg-white/[0.06] p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`relative rounded-md px-2.5 py-[3px] text-[12px] font-medium transition-colors duration-200 ${
            value === o.id ? "text-paper" : "text-mute hover:text-paper"
          }`}
        >
          {value === o.id && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-md bg-white/[0.14] shadow-[0_1px_2px_rgb(0_0_0/0.35),inset_0_0.5px_0_rgb(255_255_255/0.08)]"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
