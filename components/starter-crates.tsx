"use client";

import { SCENES } from "@/lib/scenes";
import { useProfile } from "@/lib/profile";

/** One-click crates from curator's built-in scenes, for an empty start. */
export function StarterCrates({ compact = false }: { compact?: boolean }) {
  const { profile, update } = useProfile();
  const have = new Set(profile.crates.map((c) => c.id));
  const left = SCENES.filter((s) => !have.has(s.id));
  if (!left.length) return null;
  const add = (id: string) => {
    const s = SCENES.find((x) => x.id === id)!;
    update((p) => ({
      crates: p.crates.some((c) => c.id === s.id) ? p.crates : [...p.crates, { id: s.id, name: s.name, artists: [...s.artists], years: s.years }],
      enabled: p.enabled.includes(s.id) ? p.enabled : [...p.enabled, s.id],
    }));
  };
  return (
    <div className={compact ? "" : "fade-up mx-auto max-w-2xl px-4 py-12 text-center"}>
      {!compact && (
        <>
          <h2 className="text-[19px] font-semibold tracking-tight">Start a crate</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-mute">
            Crates are the artists your recommendations come from. Start from a scene and edit it, or make your own with + in the sidebar.
          </p>
        </>
      )}
      <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-5 justify-center"}`}>
        {left.map((s) => (
          <button key={s.id} onClick={() => add(s.id)} title={s.blurb} className="btn rounded-full">
            + {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
