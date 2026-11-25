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
  | { kind: "related"; q: RelatedQuery }
  | { kind: "magic"; q: string }
  | { kind: "link"; url: string };

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
    `flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors duration-150 ${on ? "bg-white/[0.09] text-paper" : "text-paper/80 hover:bg-white/[0.05] hover:text-paper"}`;
  const inMix = profile.crates.filter((c) => profile.enabled.includes(c.id));

  return (
    <div className="flex flex-col gap-5 p-2.5">
      <div className="space-y-0.5">
        <button onClick={() => setView({ kind: "crates" })} className={row(view.kind === "crates" && !view.crateId)}>
          <NavIcon d="M3 8.5L8 4l5 4.5M4.5 7.5V13h7V7.5" />
          <span className="min-w-0 flex-1">
            <span className="block">For you</span>
            {inMix.length > 0 && <span className="block truncate text-[11px] text-mute">{inMix.length === 1 ? inMix[0].name : `${inMix.length} crates, each in its own section`}</span>}
          </span>
        </button>
        <button onClick={() => setView({ kind: "saved" })} className={row(view.kind === "saved")}>
          <NavIcon d="M8 13.5S2.5 10.2 2.5 6.3A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.3C13.5 10.2 8 13.5 8 13.5z" />
          <span className="flex-1">Saved</span>
          <span className="text-[11px] text-mute">{Object.keys(saved).length || ""}</span>
        </button>
        <button onClick={() => setView({ kind: "history" })} className={row(view.kind === "history")}>
          <NavIcon d="M8 4.5V8l2.5 1.5M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
          <span className="flex-1">History</span>
          <span className="text-[11px] text-mute">{history.length || ""}</span>
        </button>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between px-2">
          <span className="label">Crates</span>
          <button onClick={addCrate} className="grid size-5 place-items-center rounded text-[15px] text-mute transition-colors hover:bg-white/[0.08] hover:text-paper" title="New crate">
            +
          </button>
        </div>
        <div className="space-y-0.5">
        {profile.crates.map((c) => {
          const on = profile.enabled.includes(c.id);
          const active = view.kind === "crates" && view.crateId === c.id;
          const years = c.years && c.years[0] > 1900 ? `${String(c.years[0]).slice(2)}–${c.years[1] < 2100 ? String(c.years[1]).slice(2) : "now"}` : null;
          return (
            <div key={c.id} className={`group ${row(active)} relative pr-1`}>
              <button onClick={() => setView({ kind: "crates", crateId: c.id })} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <CrateTile crate={c} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.name}</span>
                  <span className="block truncate text-[11px] text-mute">
                    {c.artists.length} artists{years ? ` · ${years}` : ""}
                    {c.shareId ? " · shared" : ""}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setEditing(editing === c.id ? null : c.id)}
                className={`grid size-6 place-items-center rounded text-xs transition-opacity hover:bg-white/[0.08] hover:text-paper ${editing === c.id ? "text-accent" : "text-mute opacity-0 group-hover:opacity-100"}`}
                aria-label={`Edit ${c.name}`}
                title="Edit artists"
              >
                ✎
              </button>
              <button
                role="switch"
                aria-checked={on}
                onClick={() => update((p) => ({ enabled: on ? p.enabled.filter((x) => x !== c.id) : [...p.enabled, c.id] }))}
                title={on ? "In For you. Click to leave it out" : "Add to For you"}
                className="grid size-6 shrink-0 place-items-center rounded"
              >
                <span className={`block size-2.5 rounded-full transition-all ${on ? "bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]" : "border border-mute/60"}`} />
              </button>
            </div>
          );
        })}
        </div>
        {profile.crates.length > 0 && <p className="mt-1.5 px-2 text-[11px] leading-snug text-mute/80">The dot puts a crate in For you.</p>}
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

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-mute" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** A stable colour per crate, from its id. */
export function crateHue(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** A small coloured square with the crate's initials. */
export function CrateTile({ crate, size = "size-7" }: { crate: CrateDef; size?: string }) {
  const h = crateHue(crate.id);
  const initials = crate.name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-md text-[10px] font-bold shadow-[inset_0_0.5px_0_rgb(255_255_255/0.25)]`}
      style={{ color: "#fff", background: `linear-gradient(135deg, hsl(${h} 55% 48%), hsl(${(h + 40) % 360} 60% 32%))` }}
    >
      {initials}
    </span>
  );
}
