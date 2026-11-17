"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { getStyles, requestStyles } from "@/lib/style-store";
import { requestAnalysis } from "@/lib/analysis-store";
import { usePlayer } from "./player";
import { toast } from "./toast";

/**
 * Dig radio: keeps playing songs related to whatever is on, one after another.
 * Each refill digs from the song playing now, so it wanders the way digging does.
 */
interface RadioCtx {
  on: boolean;
  /** Songs lined up next. */
  upcoming: Track[];
  loading: boolean;
  /** Start from a song (or what's playing, or a random pick from your crates). */
  start: (seed?: Track) => void;
  stop: () => void;
  remove: (id: string) => void;
  /** Play a lined-up song now. */
  jump: (t: Track) => void;
  /** The full-screen now-playing view. */
  open: boolean;
  setOpen: (o: boolean) => void;
}

const Ctx = createContext<RadioCtx | null>(null);

export function useRadio() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRadio outside provider");
  return c;
}

const LOW = 4;

export function RadioProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();
  const { profile, history } = useProfile();
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [upcoming, setUpcoming] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const seededFrom = useRef<string | null>(null);
  const latest = useRef({ upcoming, history, profile, player });
  latest.current = { upcoming, history, profile, player };

  /** Adds related songs, dug from `from`. */
  const fill = useCallback(async (from: Track, replace = false) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const { upcoming, history, profile, player } = latest.current;
      const styles = getStyles(from.id)?.data?.top.filter((s) => s.score > 0.15).slice(0, 3).map((s) => s.name);
      const recent = history.slice(0, 150).map((h) => h.track.id);
      const queued = replace ? [] : upcoming.map((t) => t.id);
      const res = await fetch("/api/related", {
        method: "POST",
        body: JSON.stringify({
          by: "style",
          value: from.title,
          track: { ...from, tags: [] },
          styles,
          exclude: [...profile.disliked, ...recent, ...queued, from.id],
          seed: String(Math.random()),
        }),
      });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { known?: Track[]; deep?: Track[] };
      // Two known records, then a deep cut, and so on; one song per artist.
      const known = (d.known ?? []).filter((t) => t.type === "song");
      const deep = d.deep ?? [];
      const mixed: Track[] = [];
      while (known.length || deep.length) {
        if (known.length) mixed.push(known.shift()!);
        if (known.length) mixed.push(known.shift()!);
        if (deep.length) mixed.push(deep.shift()!);
      }
      const skip = new Set([...recent, ...queued, from.id, ...profile.disliked]);
      const artists = new Set([from.artist.toLowerCase(), ...(replace ? [] : upcoming.map((t) => t.artist.toLowerCase()))]);
      const fresh = mixed.filter((t) => {
        if (skip.has(t.id) || !player.canPlay(t)) return false;
        const a = t.artist.toLowerCase();
        if (artists.has(a)) return false;
        artists.add(a);
        return true;
      });
      const add = fresh.slice(0, 10);
      for (const t of add) {
        if (t.audioUrl) requestAnalysis(t);
        requestStyles(t);
      }
      setUpcoming((u) => (replace ? add : [...u, ...add]));
      if (!add.length && (replace || !upcoming.length)) toast("Radio couldn't find more from here. Try another song.");
    } catch {
      toast("Radio couldn't dig right now. Try again in a moment.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  const start = useCallback(
    async (seed?: Track) => {
      const { player, profile } = latest.current;
      let from = seed ?? player.track ?? null;
      setOn(true);
      setOpen(true);
      if (!from) {
        const crates = profile.crates.filter((c) => profile.enabled.includes(c.id));
        if (!crates.length) {
          setOn(false);
          setOpen(false);
          toast("Play a song first, or switch on a crate, to start the radio.");
          return;
        }
        setLoading(true);
        const r = await fetch("/api/random", { method: "POST", body: JSON.stringify({ crates, exclude: profile.disliked }) })
          .then((x) => x.json() as Promise<{ track: Track | null }>)
          .catch(() => ({ track: null }));
        setLoading(false);
        from = r.track;
        if (!from) return toast("Couldn't find a song to start from.");
      }
      if (player.track?.id !== from.id && player.canPlay(from)) player.play(from, undefined, [from]);
      requestStyles(from, true);
      seededFrom.current = from.id;
      setUpcoming([]);
      void fill(from, true);
    },
    [fill],
  );

  const stop = useCallback(() => {
    setOn(false);
    setUpcoming([]);
    seededFrom.current = null;
  }, []);

  const remove = useCallback((id: string) => setUpcoming((u) => u.filter((t) => t.id !== id)), []);
  const jump = useCallback((t: Track) => latest.current.player.play(t), []);

  // What plays after this song is the radio's line-up.
  const current = player.track;
  const setQueue = player.setQueue;
  useEffect(() => {
    if (on && current) setQueue([current, ...upcoming]);
  }, [on, current, upcoming, setQueue]);

  // Follow along: when a lined-up song starts, drop it (and anything skipped before it).
  // When you play something else, the radio digs from that instead.
  useEffect(() => {
    if (!on || !current) return;
    const i = latest.current.upcoming.findIndex((t) => t.id === current.id);
    if (i >= 0) setUpcoming((u) => u.slice(i + 1));
    else if (seededFrom.current !== current.id) {
      seededFrom.current = current.id;
      void fill(current, true);
    }
  }, [on, current, fill]);

  // Top up when running low, digging from the song playing now.
  useEffect(() => {
    if (on && current && !loading && upcoming.length < LOW) void fill(current);
  }, [on, current, loading, upcoming.length, fill]);

  const value = useMemo(
    () => ({ on, upcoming, loading, start: (s?: Track) => void start(s), stop, remove, jump, open, setOpen }),
    [on, upcoming, loading, start, stop, remove, jump, open],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function RadioIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
    </svg>
  );
}

/** The radio button in the header: starts dig radio and opens the full-screen view. */
export function RadioButton() {
  const r = useRadio();
  return (
    <button
      onClick={() => (r.on ? r.setOpen(true) : r.start())}
      aria-label={r.on ? "Open radio" : "Start dig radio"}
      title={r.on ? "Dig radio is on · open it" : "Dig radio: keeps playing related songs"}
      className={`relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/[0.08] hover:text-paper ${r.on ? "text-accent" : "text-mute"}`}
    >
      <RadioIcon />
      {r.on && <span className="absolute right-1 top-1 size-1.5 animate-pulse rounded-full bg-accent" />}
    </button>
  );
}
