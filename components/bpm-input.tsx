"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/lib/profile";

const MIN = 60, MAX = 200;

/**
 * Edits the project BPM. Typing is free (you can clear "124" and type "128");
 * the value is checked and saved on Enter, on leaving the box, or as soon as
 * what you've typed is a complete in-range tempo. ↑/↓ step by 1, Esc undoes.
 */
export function BpmInput({ className = "" }: { className?: string }) {
  const { profile, update } = useProfile();
  const [draft, setDraft] = useState(String(profile.projectBpm));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(profile.projectBpm));
  }, [profile.projectBpm, editing]);

  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    const v = Number.isFinite(n) && raw.trim() !== "" ? Math.max(MIN, Math.min(MAX, n)) : profile.projectBpm;
    update({ projectBpm: v });
    setDraft(String(v));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label="Project BPM"
      title="Project BPM (60–200). Enter to set, ↑/↓ to nudge."
      value={draft}
      onFocus={(e) => {
        setEditing(true);
        e.target.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
        setDraft(raw);
        const n = Number(raw);
        // Save straight away once it's a full tempo, so Sync follows as you type.
        if (raw.length >= 2 && n >= MIN && n <= MAX) update({ projectBpm: n });
      }}
      onBlur={() => {
        setEditing(false);
        commit(draft);
      }}
      onKeyDown={(e) => {
        e.stopPropagation(); // keep shortcuts (space, R, D…) out of the box
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        else if (e.key === "Escape") {
          setDraft(String(profile.projectBpm));
          setEditing(false);
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const v = Math.max(MIN, Math.min(MAX, (Number(draft) || profile.projectBpm) + (e.key === "ArrowUp" ? 1 : -1)));
          setDraft(String(v));
          update({ projectBpm: v });
        }
      }}
      className={`field font-mono ${className}`}
    />
  );
}
