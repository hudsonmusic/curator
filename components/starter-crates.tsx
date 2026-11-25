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
    <div className={compact ? "" : "fade-up mx-auto max-w-4xl px-4 py-10 text-center"}>
      {!compact && (
        <>
          <h2 className="text-[19px] font-semibold tracking-tight">Start a crate</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-mute">
            Each crate is a scene: its artists, plus deep cuts from the same years by people you won&apos;t know yet. Add a few, edit them, or make your own with + in the sidebar.
          </p>
        </>
      )}
      {compact ? (
        <div className="flex flex-wrap gap-1.5">
          {left.map((s) => (
            <button key={s.id} onClick={() => add(s.id)} title={`${s.blurb} · ${s.artists.slice(0, 4).join(", ")}…`} className="btn rounded-full">
              + {s.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-2 text-left sm:grid-cols-2 lg:grid-cols-3">
          {left.map((s) => (
            <button
              key={s.id}
              onClick={() => add(s.id)}
              className="group rounded-xl border border-line bg-white/[0.03] p-3 text-left transition-colors hover:border-accent/50 hover:bg-white/[0.06]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold">{s.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-mute">
                  {s.years[0]}–{String(s.years[1]).slice(2)}
                </span>
              </div>
              <div className="mt-0.5 text-[12px] text-paper/70">{s.blurb}</div>
              <div className="mt-1.5 truncate text-[11px] text-mute">{s.artists.slice(0, 4).join(" · ")}</div>
              <div className="mt-2 text-[11px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">+ Add crate</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
