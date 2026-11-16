"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { useConfig } from "@/lib/config";
import { useAnalysisVersion } from "@/lib/analysis-store";
import { CratesPanel, type View } from "@/components/crates-panel";
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
  const { ready, profile, likedArtists, saved } = useProfile();
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
    view.kind === "search"
      ? `“${view.q}”`
      : view.kind === "saved"
        ? "Saved"
        : view.crateId
          ? profile.crates.find((c) => c.id === view.crateId)?.name ?? "Crate"
          : "For you";

  if (!ready) return null;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-line bg-ink px-4">
        <span className="shrink-0 font-mono text-sm font-semibold tracking-tight">
          curator<span className="text-acid">_</span>
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
            className="h-9 w-full rounded-md border border-line bg-panel pl-9 pr-10 text-sm outline-none placeholder:text-mute/70 focus:border-acid"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[10px] text-mute">/</kbd>
        </form>
        <div className="ml-auto hidden gap-3 font-mono text-[10px] uppercase tracking-wider text-mute xl:flex">
          <span>space play</span>
          <span>↑↓ move</span>
          <span>enter details</span>
          <span>s save</span>
          <span>r random</span>
          <span>m mark</span>
        </div>
      </header>

      <div className="grid md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="border-b border-line md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:overflow-y-auto md:border-b-0 md:border-r md:pb-20">
          <button
            onClick={() => setShowCrates((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-mute md:hidden"
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

        <main className="min-w-0 pb-20">
          <RandomPick crates={enabled} decades={filters.decades} />
          <FilterBar f={filters} set={setFilters} genres={genres} loopsAvailable={!!config?.freesound} />
          <div className="flex items-center gap-3 px-3 py-2.5">
            <h1 className="text-sm font-semibold">{title}</h1>
            <span className="font-mono text-[11px] text-mute">
              {groups ? `${shownCount}${filtersActive(filters) ? ` of ${all.length}` : ""} tracks` : "loading…"}
              {waiting > 0 && ` · ${waiting} still analysing`}
            </span>
            {view.kind !== "saved" && (
              <button
                onClick={() => setNonce((n) => n + 1)}
                className="ml-auto rounded-md border border-line px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-mute hover:border-paper hover:text-paper"
              >
                ↻ refresh
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
                <div key={i} className="h-11 animate-pulse rounded bg-panel/60" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
