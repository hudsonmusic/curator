"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { loadShared, type SharedCrate } from "@/lib/share";
import { accountsEnabled } from "@/lib/account";
import { TrackTable } from "@/components/track-table";
import { RadioButton } from "@/components/radio";
import { toast } from "@/components/toast";

/** A crate someone shared: its songs, and a button to add it to your own crates. */
export default function SharedCratePage() {
  const { id } = useParams<{ id: string }>();
  const { ready, profile, update } = useProfile();
  const [shared, setShared] = useState<SharedCrate | null | undefined>(undefined);
  const [tracks, setTracks] = useState<Track[] | null>(null);

  useEffect(() => {
    if (!accountsEnabled) return setShared(null);
    loadShared(id)
      .then(setShared)
      .catch(() => setShared(null));
  }, [id]);

  const crate = shared?.crate;
  useEffect(() => {
    if (!crate) return;
    let live = true;
    fetch("/api/crate", {
      method: "POST",
      body: JSON.stringify({
        crates: [{ id: crate.scene ?? `shared-${id}`, name: crate.name, artists: crate.artists, years: crate.years }],
        types: ["song", "acapella", "loop"],
        seed: `${id}:${new Date().toISOString().slice(0, 10)}`,
        size: 40,
      }),
    })
      .then((r) => r.json() as Promise<{ tracks?: Track[]; deep?: Track[] }>)
      .then((d) => live && setTracks([...(d.tracks ?? []), ...(d.deep ?? [])]))
      .catch(() => live && setTracks([]));
    return () => {
      live = false;
    };
  }, [crate, id]);

  const mine = useMemo(() => profile.crates.find((c) => c.fromShare === id || c.shareId === id), [profile.crates, id]);
  useEffect(() => {
    if (crate) document.title = `${crate.name} · curator`;
  }, [crate]);

  const add = () => {
    if (!crate) return;
    const cid = `c${Date.now().toString(36)}`;
    update((p) => ({
      crates: [...p.crates, { id: cid, name: crate.name, artists: crate.artists, years: crate.years, fromShare: id }],
      enabled: [...p.enabled, cid],
    }));
    toast(`Added “${crate.name}” to your crates.`);
  };

  return (
    <div className="min-h-dvh pb-32">
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line px-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
          <span className="size-3 rounded-full bg-accent shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]" />
          curator
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <RadioButton />
        </div>
      </header>

      {shared === undefined || !ready ? (
        <div className="px-4 py-20 text-center text-mute">Opening crate…</div>
      ) : !shared || !crate ? (
        <div className="fade-up mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-xl font-semibold">This crate isn&apos;t shared anymore</h1>
          <p className="mt-2 text-[13px] text-mute">The link may be wrong, or whoever shared it stopped sharing.</p>
          <Link href="/" className="btn btn-on mt-5 rounded-full px-4">
            Open curator
          </Link>
        </div>
      ) : (
        <>
          <section className="fade-up mx-auto max-w-5xl px-4 pb-4 pt-8">
            <div className="label">Shared crate</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{crate.name}</h1>
            <p className="mt-1 text-[13px] text-mute">
              {crate.artists.length} artist{crate.artists.length === 1 ? "" : "s"}
              {crate.years && ` · ${crate.years[0]}–${crate.years[1] < 2100 ? crate.years[1] : "now"}`}
            </p>
            <div className="mt-3 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
              {crate.artists.map((a) => (
                <span key={a} className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[12px]">
                  {a}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {mine ? (
                <Link href="/" className="btn rounded-full px-4">
                  In your crates ✓ · open
                </Link>
              ) : (
                <button onClick={add} className="btn btn-on rounded-full px-4">
                  + Add to my crates
                </button>
              )}
              <span className="text-[12px] text-mute">Songs change each day; the artists stay.</span>
            </div>
          </section>
          <div className="mx-auto max-w-5xl">
            {tracks ? (
              <TrackTable groups={[{ tracks }]} emptyText="No songs found for this crate right now." />
            ) : (
              <div className="space-y-px px-3">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="h-11 animate-pulse rounded-lg bg-white/[0.04]" style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
