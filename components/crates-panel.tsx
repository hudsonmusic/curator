"use client";

import { useState } from "react";
import { useProfile } from "@/lib/profile";
import type { CrateDef } from "@/lib/types";

export type View = { kind: "crates"; crateId?: string } | { kind: "search"; q: string } | { kind: "saved" };

/** Your crates. Toggle which feed recommendations, open one to edit its artists. */
export function CratesPanel({ view, setView }: { view: View; setView: (v: View) => void }) {
  const { profile, update, saved } = useProfile();
  const [editing, setEditing] = useState<string | null>(null);
  const [newArtist, setNewArtist] = useState("");
  const crate = profile.crates.find((c) => c.id === editing);

  const patchCrate = (id: string, patch: Partial<CrateDef>) =>
    update((p) => ({ crates: p.crates.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const addCrate = () => {
    const id = `c${Date.now().toString(36)}`;
    update((p) => ({ crates: [...p.crates, { id, name: "New crate", artists: [] }], enabled: [...p.enabled, id] }));
    setEditing(id);
  };

  const row = (on: boolean) =>
    `flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${on ? "bg-line text-paper" : "text-mute hover:bg-panel hover:text-paper"}`;

  return (
    <div className="flex flex-col gap-6 p-3">
      <div>
        <button onClick={() => setView({ kind: "crates" })} className={row(view.kind === "crates" && !view.crateId)}>
          <span className="flex-1">For you</span>
          <span className="font-mono text-[10px] text-mute">{profile.enabled.length} crates</span>
        </button>
        <button onClick={() => setView({ kind: "saved" })} className={row(view.kind === "saved")}>
          <span className="flex-1">Saved</span>
          <span className="font-mono text-[10px] text-mute">{Object.keys(saved).length}</span>
        </button>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-wider text-mute">
          <span>My crates</span>
          <button onClick={addCrate} className="hover:text-paper">
            + new
          </button>
        </div>
        {profile.crates.map((c) => {
          const on = profile.enabled.includes(c.id);
          const active = view.kind === "crates" && view.crateId === c.id;
          return (
            <div key={c.id} className={`group ${row(active)} pr-1`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  update((p) => ({ enabled: on ? p.enabled.filter((x) => x !== c.id) : [...p.enabled, c.id] }))
                }
                title="Include in For you and random picks"
                className="size-3.5 shrink-0 accent-[var(--color-acid)]"
              />
              <button onClick={() => setView({ kind: "crates", crateId: c.id })} className="min-w-0 flex-1 truncate text-left">
                {c.name}
              </button>
              <span className="font-mono text-[10px] text-mute">{c.artists.length}</span>
              <button
                onClick={() => setEditing(editing === c.id ? null : c.id)}
                className={`px-1 text-xs hover:text-paper ${editing === c.id ? "text-acid" : "text-mute/50"}`}
                aria-label={`Edit ${c.name}`}
                title="Edit artists"
              >
                ✎
              </button>
            </div>
          );
        })}
      </div>

      {crate && (
        <div className="rounded-md border border-line p-3">
          <input
            value={crate.name}
            onChange={(e) => patchCrate(crate.id, { name: e.target.value })}
            className="w-full bg-transparent text-sm font-medium outline-none"
            aria-label="Crate name"
          />
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-mute">
            years
            <input
              value={crate.years?.[0] ?? ""}
              placeholder="any"
              onChange={(e) => {
                const lo = +e.target.value;
                patchCrate(crate.id, { years: lo ? [lo, crate.years?.[1] ?? 2100] : undefined });
              }}
              className="w-12 rounded border border-line bg-transparent px-1 py-0.5 text-center text-paper outline-none focus:border-acid"
            />
            –
            <input
              value={crate.years && crate.years[1] < 2100 ? crate.years[1] : ""}
              placeholder="any"
              onChange={(e) => {
                const hi = +e.target.value || 2100;
                patchCrate(crate.id, { years: [crate.years?.[0] ?? 1900, hi] });
              }}
              className="w-12 rounded border border-line bg-transparent px-1 py-0.5 text-center text-paper outline-none focus:border-acid"
            />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const a = newArtist.trim();
              if (a && !crate.artists.includes(a)) patchCrate(crate.id, { artists: [a, ...crate.artists] });
              setNewArtist("");
            }}
            className="mt-3"
          >
            <input
              value={newArtist}
              onChange={(e) => setNewArtist(e.target.value)}
              placeholder="Add artist + Enter"
              className="w-full rounded border border-line bg-transparent px-2 py-1.5 text-[13px] outline-none placeholder:text-mute/60 focus:border-acid"
            />
          </form>
          <div className="mt-2 flex max-h-56 flex-wrap gap-1 overflow-y-auto">
            {crate.artists.map((a) => (
              <span key={a} className="flex items-center gap-1 rounded bg-line px-1.5 py-0.5 text-xs">
                {a}
                <button
                  onClick={() => patchCrate(crate.id, { artists: crate.artists.filter((x) => x !== a) })}
                  className="text-mute hover:text-paper"
                  aria-label={`Remove ${a}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-wider">
            <button
              onClick={() => {
                if (!confirm(`Delete crate “${crate.name}”?`)) return;
                update((p) => ({ crates: p.crates.filter((c) => c.id !== crate.id), enabled: p.enabled.filter((x) => x !== crate.id) }));
                setEditing(null);
                if (view.kind === "crates" && view.crateId === crate.id) setView({ kind: "crates" });
              }}
              className="text-mute hover:text-red-300"
            >
              delete
            </button>
            <button onClick={() => setEditing(null)} className="text-mute hover:text-paper">
              done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
