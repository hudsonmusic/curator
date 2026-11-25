"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useProfile } from "@/lib/profile";
import { onGrow, startGrowing, stopGrowing } from "@/lib/grow";

/** Keeps "Grow the sound index" running on any page while it's switched on. */
export function Grower() {
  const { ready, profile } = useProfile();
  useEffect(() => {
    if (!ready) return;
    if (profile.grow) startGrowing();
    else stopGrowing();
  }, [ready, profile.grow]);
  return null;
}

export function useIndexSize() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/sounds/count")
        .then((r) => r.json() as Promise<{ count: number }>)
        .then((d) => live && setN(d.count))
        .catch(() => {});
    void load();
    const id = setInterval(load, 60000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return n;
}

/** Settings: the shared sound index and growing it. */
export function SoundIndexSettings({
  Row,
  Toggle,
}: {
  Row: (p: { label: string; sub?: ReactNode; children: ReactNode }) => ReactNode;
  Toggle: (p: { on: boolean; set: (v: boolean) => void; label: string }) => ReactNode;
}) {
  const { profile, update } = useProfile();
  const size = useIndexSize();
  const [grow, setGrow] = useState({ running: false, heard: 0, added: 0, status: "Off" });
  useEffect(() => {
    const off = onGrow(setGrow);
    return () => {
      off();
    };
  }, []);
  return (
    <>
      <p className="text-[13px] text-paper/80">
        {size === null ? "…" : size.toLocaleString()} songs fingerprinted so far. Every song anyone hears in curator is added, and{" "}
        <span className="text-paper">Similar songs</span> searches all of them by sound, so the more it grows, the deeper the matches.
      </p>
      <Row
        label="Grow the index while curator is open"
        sub="Keeps digging up obscure records in the background and listening to their previews. Leave a tab open (even overnight) to add a few hundred an hour."
      >
        <Toggle on={profile.grow} set={(v) => update({ grow: v })} label="Grow the index" />
      </Row>
      {profile.grow && (
        <p className="text-[12px] text-mute">
          {grow.status}
          {grow.running && ` · heard ${grow.heard}, added ${grow.added} new this session`}
        </p>
      )}
    </>
  );
}
