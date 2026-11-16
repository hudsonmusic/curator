"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { useConfig } from "@/lib/config";
import { useAnalysisVersion } from "@/lib/analysis-store";
import { CratesPanel, type View } from "@/components/crates-panel";
import { AccentPicker } from "@/components/accent-picker";
import { FilterBar } from "@/components/filter-bar";
import { RandomPick } from "@/components/random-pick";
import { TrackTable, type Group } from "@/components/track-table";
import { EMPTY_FILTERS, applyFilters, filtersActive } from "@/components/meta";

const cache = new Map<string, Group[]>();

async function load(url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, body ? { method: "POST", body: JSON.stringify(body) } : undefined);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export default function Dashboard() {
  const { ready, profile, likedArtists, saved, update } = useProfile();
  const [notice, setNotice] = useState<string | null>(null);

  // Back from SoundCloud sign-in.
  useEffect(() => {
    const sc = new URLSearchParams(location.search).get("sc");
    if (!sc) return;
    setNotice(sc === "connected" ? "SoundCloud connected. Your likes and playlists are in the sidebar." : "Couldn't connect SoundCloud. Try again.");
    const url = new URL(location.href);
    url.searchParams.delete("sc");
    history.replaceState(null, "", url);
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, []);
  const config = useConfig();
  useAnalysisVersion();
  const [view, setView] = useState<View>({ kind: "crates" });
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [fetched, setFetched] = useState<Group[] | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [showCrates, setShowCrates] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const enabled = useMemo(() => profile.crates.filter((c) => profile.enabled.includes(c.id)), [profile.crates, profile.enabled]);
  const viewCrates = view.kind === "crates" && view.crateId ? profile.crates.filter((c) => c.id === view.crateId) : enabled;
  const cratesKey = JSON.stringify(viewCrates.map((c) => [c.id, c.artists.length, c.years]));

  useEffect(() => {
    if (!ready || view.kind === "saved") return;
    let body: unknown, url: string;
    if (view.kind === "search") {
      url = `/api/search?q=${encodeURIComponent(view.q)}&type=all`;
    } else if (view.kind === "sc") {
      url = view.id === "likes" ? `/api/soundcloud/likes?n=${nonce}` : `/api/soundcloud/playlists/${view.id}?n=${nonce}`;
    } else {
      url = "/api/crate";
      body = {
        crates: viewCrates,
        types: ["song", "acapella", "loop"],
        weights: profile.sceneWeights,
        likedArtists,
        exclude: profile.disliked,
        seed: `${new Date().toISOString().slice(0, 10)}:${nonce}:${view.crateId ?? "all"}`,
        size: 32,
      };
    }
    const key = url + JSON.stringify(body ?? "") + cratesKey;
    const hit = cache.get(key);
    if (hit) return setFetched(hit);
    let cancelled = false;
    setFetched(null);
    setError(false);
    load(url, body)
      .then((d) => {
        const data = d as { tracks: Track[]; related?: { scene: string; tracks: Track[] } };
        const groups: Group[] = [{ tracks: data.tracks }];
        if (data.related?.tracks.length) groups.push({ label: `Same scene · ${data.related.scene}`, tracks: data.related.tracks });
        cache.set(key, groups);
        if (!cancelled) setFetched(groups);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, nonce, cratesKey]);

  const groups: Group[] | null = useMemo(
    () =>
      view.kind === "saved"
        ? [{ tracks: Object.values(saved).sort((a, b) => b.savedAt - a.savedAt).map((s) => s.track) }]
        : fetched,
    [view.kind, saved, fetched],
  );

  const all = useMemo(() => groups?.flatMap((g) => g.tracks) ?? [], [groups]);
  let waiting = 0;
  const filtered = groups?.map((g) => {
    const r = applyFilters(g.tracks, filters);
    waiting += r.waiting;
    return { ...g, tracks: r.shown };
  });
  const shownCount = filtered?.reduce((n, g) => n + g.tracks.length, 0) ?? 0;
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of all) if (t.genre) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([g]) => g);
  }, [all]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title =
    view.kind === "sc"
      ? view.name
      : view.kind === "search"
      ? `“${view.q}”`
      : view.kind === "saved"
        ? "Saved"
        : view.crateId
          ? profile.crates.find((c) => c.id === view.crateId)?.name ?? "Crate"
          : "For you";

  if (!ready) return null;

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-line px-4">
        <span className="flex shrink-0 items-center gap-2 text-[14px] font-semibold tracking-tight">
          <span className="size-3 rounded-full bg-accent shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]" />
          curator
        </span>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = q.trim();
            setView(v ? { kind: "search", q: v } : { kind: "crates" });
            searchRef.current?.blur();
          }}
          className="relative max-w-2xl flex-1"
        >
          <svg viewBox="0 0 16 16" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-mute" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && searchRef.current?.blur()}
            placeholder="Search artists, songs, acapellas…"
            className="h-8 w-full rounded-lg bg-white/[0.07] pl-9 pr-10 text-[13px] outline-none transition-shadow duration-200 placeholder:text-mute/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-white/[0.08] px-1.5 font-mono text-[10px] text-mute">/</kbd>
        </form>
        <div className="ml-auto hidden gap-3 text-[11px] text-mute xl:flex">
          {[["Space", "play"], ["↑↓", "move"], ["↵", "details"], ["S", "save"], ["R", "random"], ["M", "mark"]].map(([k, v]) => (
            <span key={k}>
              <kbd className="mr-1 rounded bg-white/[0.08] px-1 font-mono text-[10px]">{k}</kbd>
              {v}
            </span>
          ))}
        </div>
        <div className="ml-auto xl:ml-0">
          <AccentPicker />
        </div>
      </header>

      <div className="grid md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="glass border-b border-line md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:overflow-y-auto md:border-b-0 md:border-r md:pb-28">
          <button
            onClick={() => setShowCrates((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-[12px] font-medium text-mute md:hidden"
          >
            <span>{title}</span>
            <span>crates {showCrates ? "▴" : "▾"}</span>
          </button>
          <div className={showCrates ? "block" : "hidden md:block"}>
            <CratesPanel
              view={view}
              setView={(v) => {
                setView(v);
                setShowCrates(false);
                if (v.kind !== "search") setQ("");
              }}
            />
          </div>
        </aside>

        <main className="min-w-0 pb-28">
          {notice && <div className="fade-up mx-3 mt-3 rounded-lg bg-white/[0.06] px-3 py-2 text-[12px]">{notice}</div>}
          <RandomPick crates={enabled} decades={filters.decades} />
          <FilterBar f={filters} set={setFilters} genres={genres} loopsAvailable={!!config?.freesound} />
          <div className="flex items-center gap-3 px-4 pb-2 pt-1">
            <h1 className="text-[17px] font-semibold tracking-tight">{title}</h1>
            <span className="text-[12px] text-mute">
              {groups ? `${shownCount}${filtersActive(filters) ? ` of ${all.length}` : ""} tracks` : "loading…"}
              {waiting > 0 && ` · ${waiting} still analysing`}
            </span>
            {view.kind === "sc" && all.length > 0 && (
              <button
                onClick={() => {
                  // Turn this playlist into a crate: its most frequent artists.
                  const counts = new Map<string, number>();
                  for (const t of all) counts.set(t.artist, (counts.get(t.artist) ?? 0) + 1);
                  const artists = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([a]) => a);
                  const id = `c${Date.now().toString(36)}`;
                  update((p) => ({ crates: [...p.crates, { id, name: view.name, artists }], enabled: [...p.enabled, id] }));
                  setView({ kind: "crates", crateId: id });
                }}
                className="btn ml-auto"
                title="Create a crate from the artists in this list"
              >
                + Make crate
              </button>
            )}
            {view.kind !== "saved" && (
              <button
                onClick={() => setNonce((n) => n + 1)}
                className={`btn ${view.kind === "sc" && all.length > 0 ? "" : "ml-auto"}`}
              >
                ↻ Refresh
              </button>
            )}
          </div>
          {error ? (
            <div className="px-4 py-16 text-center text-mute">Couldn&apos;t load tracks. Hit refresh.</div>
          ) : filtered ? (
            <TrackTable
              groups={filtered}
              emptyText={
                all.length
                  ? waiting
                    ? "Analysing BPM and key… matches will appear here."
                    : "Nothing matches these filters."
                  : view.kind === "saved"
                    ? "Nothing saved yet. Press S on a track or hit the heart."
                    : view.kind === "crates" && !viewCrates.length
                      ? "Switch on a crate on the left."
                      : "Nothing found."
              }
            />
          ) : (
            <div className="space-y-px px-3">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-white/[0.04]" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
