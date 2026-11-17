"use client";

import { useEffect, useRef, useState } from "react";
import { shareCrate, shareUrl, unshareCrate, updateShared } from "@/lib/share";
import { accountsEnabled } from "@/lib/account";
import { toast } from "./toast";
import { useProfile } from "@/lib/profile";
import type { CrateDef, RelatedQuery } from "@/lib/types";
import { SoundCloudSection } from "./soundcloud-section";

export type View =
  | { kind: "crates"; crateId?: string }
  | { kind: "search"; q: string }
  | { kind: "saved" }
  | { kind: "history" }
  | { kind: "sc"; id: string; name: string }
  | { kind: "related"; q: RelatedQuery };

/** Your crates. Toggle which feed recommendations, open one to edit its artists. */
export function CratesPanel({ view, setView }: { view: View; setView: (v: View) => void }) {
  const { profile, update, saved, history, account } = useProfile();
  const [editing, setEditing] = useState<string | null>(null);
  const [newArtist, setNewArtist] = useState("");
  const crate = profile.crates.find((c) => c.id === editing);

  const patchCrate = (id: string, patch: Partial<CrateDef>) =>
    update((p) => ({ crates: p.crates.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  // Keep shared copies in step with your edits (a moment after you stop typing).
  const pushed = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!account) return;
    const changed = profile.crates.filter((c) => {
      if (!c.shareId) return false;
      const sig = JSON.stringify([c.name, c.artists, c.years]);
      if (pushed.current[c.id] === undefined) {
        pushed.current[c.id] = sig;
        return false;
      }
      return pushed.current[c.id] !== sig;
    });
    if (!changed.length) return;
    const id = setTimeout(() => {
      for (const c of changed) {
        pushed.current[c.id] = JSON.stringify([c.name, c.artists, c.years]);
        void updateShared(c);
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [account, profile.crates]);

  const copyLink = async (shareId: string) => {
    const url = shareUrl(shareId);
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) await navigator.share({ url, title: "A crate on curator" });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied. Anyone with it can open this crate and add it to theirs.");
      }
    } catch {
      prompt("Copy this link:", url);
    }
  };

  const share = async (c: CrateDef) => {
    try {
      const shareId = await shareCrate(c);
      pushed.current[c.id] = JSON.stringify([c.name, c.artists, c.years]);
      if (!c.shareId) patchCrate(c.id, { shareId });
      await copyLink(shareId);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't share this crate.");
    }
  };

  const addCrate = () => {
    const id = `c${Date.now().toString(36)}`;
    update((p) => ({ crates: [...p.crates, { id, name: "New crate", artists: [] }], enabled: [...p.enabled, id] }));
    setEditing(id);
  };

  const row = (on: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[13px] transition-colors duration-150 ${on ? "bg-white/[0.1] text-paper" : "text-paper/75 hover:bg-white/[0.05] hover:text-paper"}`;

  return (
    <div className="flex flex-col gap-5 p-2.5">
      <div>
        <button onClick={() => setView({ kind: "crates" })} className={row(view.kind === "crates" && !view.crateId)}>
          <span className="flex-1">For you</span>
          <span className="text-[11px] text-mute">{profile.enabled.length}</span>
        </button>
        <button onClick={() => setView({ kind: "saved" })} className={row(view.kind === "saved")}>
          <span className="flex-1">Saved</span>
          <span className="text-[11px] text-mute">{Object.keys(saved).length}</span>
        </button>
        <button onClick={() => setView({ kind: "history" })} className={row(view.kind === "history")}>
          <span className="flex-1">History</span>
          <span className="text-[11px] text-mute">{history.length}</span>
        </button>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-semibold text-mute">
          <span>My Crates</span>
          <button onClick={addCrate} className="grid size-5 place-items-center rounded text-[15px] font-normal transition-colors hover:bg-white/[0.08] hover:text-paper" title="New crate">
            +
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
                className="size-3.5 shrink-0 cursor-pointer accent-[var(--color-accent)]"
              />
              <button onClick={() => setView({ kind: "crates", crateId: c.id })} className="min-w-0 flex-1 truncate text-left">
                {c.name}
              </button>
              {c.shareId && (
                <span title="Shared by link" className="text-[10px] text-accent">
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                    <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" />
                  </svg>
                </span>
              )}
              <span className="text-[11px] text-mute">{c.artists.length}</span>
              <button
                onClick={() => setEditing(editing === c.id ? null : c.id)}
                className={`px-1 text-xs hover:text-paper ${editing === c.id ? "text-accent" : "text-mute/50"}`}
                aria-label={`Edit ${c.name}`}
                title="Edit artists"
              >
                ✎
              </button>
            </div>
          );
        })}
      </div>

      <SoundCloudSection view={view} setView={setView} />

      {crate && (
        <div className="fade-up rounded-xl border border-line bg-white/[0.04] p-3 shadow-[0_8px_24px_rgb(0_0_0/0.25)]">
          <input
            value={crate.name}
            onChange={(e) => patchCrate(crate.id, { name: e.target.value })}
            className="w-full bg-transparent text-sm font-medium outline-none"
            aria-label="Crate name"
          />
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-mute">
            years
            <input
              value={crate.years?.[0] ?? ""}
              placeholder="any"
              onChange={(e) => {
                const lo = +e.target.value;
                patchCrate(crate.id, { years: lo ? [lo, crate.years?.[1] ?? 2100] : undefined });
              }}
              className="field w-12 px-1 py-0.5 text-center font-mono"
            />
            –
            <input
              value={crate.years && crate.years[1] < 2100 ? crate.years[1] : ""}
              placeholder="any"
              onChange={(e) => {
                const hi = +e.target.value || 2100;
                patchCrate(crate.id, { years: [crate.years?.[0] ?? 1900, hi] });
              }}
              className="field w-12 px-1 py-0.5 text-center font-mono"
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
              className="field w-full py-1.5 text-[13px]"
            />
          </form>
          <div className="mt-2 flex max-h-56 flex-wrap gap-1 overflow-y-auto">
            {crate.artists.map((a) => (
              <span key={a} className="flex items-center gap-1 rounded-full bg-white/[0.08] py-0.5 pl-2 pr-1.5 text-xs">
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
          {accountsEnabled && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-[12px]">
              {crate.shareId ? (
                <>
                  <button onClick={() => void copyLink(crate.shareId!)} className="btn">
                    Copy link
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("Stop sharing? The link will stop working.")) return;
                      await unshareCrate(crate.shareId!);
                      patchCrate(crate.id, { shareId: undefined });
                      toast("Stopped sharing.");
                    }}
                    className="btn text-mute"
                  >
                    Stop sharing
                  </button>
                  <span className="text-[11px] text-mute">Edits update the link.</span>
                </>
              ) : (
                <>
                  <button onClick={() => void share(crate)} className="btn" disabled={!crate.artists.length}>
                    Share crate
                  </button>
                  <span className="text-[11px] text-mute">{account ? "Friends get a link to open it" : "Sign in to share"}</span>
                </>
              )}
            </div>
          )}
          <div className="mt-3 flex justify-between text-[12px]">
            <button
              onClick={() => {
                if (!confirm(`Delete crate “${crate.name}”?${crate.shareId ? " Its shared link stops working too." : ""}`)) return;
                if (crate.shareId) void unshareCrate(crate.shareId);
                update((p) => ({ crates: p.crates.filter((c) => c.id !== crate.id), enabled: p.enabled.filter((x) => x !== crate.id) }));
                setEditing(null);
                if (view.kind === "crates" && view.crateId === crate.id) setView({ kind: "crates" });
              }}
              className="text-mute hover:text-red-300"
            >
              Delete
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-on px-3">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
