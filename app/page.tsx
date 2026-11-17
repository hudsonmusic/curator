"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RelatedQuery, Track } from "@/lib/types";
import { useProfile, type Played } from "@/lib/profile";
import { useConfig } from "@/lib/config";
import { requestAnalysis, useAnalysisVersion } from "@/lib/analysis-store";
import { requestStyles, similarity, topStyle, useStylesVersion, getStyles } from "@/lib/style-store";
import { CratesPanel, type View } from "@/components/crates-panel";
import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { RandomPick } from "@/components/random-pick";
import { TrackTable, type Group } from "@/components/track-table";
import { EMPTY_FILTERS, applyFilters, filtersActive, metaOf, type Filters } from "@/components/meta";
import { onRelated } from "@/components/related";
import { StarterCrates } from "@/components/starter-crates";
import { RadioButton } from "@/components/radio";
import { looksLikeLabel } from "@/lib/sc-names";

const cache = new Map<string, Group[]>();

const DEEP_NOTE = "Obscure records from MusicBrainz. BPM and key show for the ones Apple has a preview of; the rest play in full via YouTube.";

/** Filters a related view starts with: the seed's BPM (±6%) and, if asked, a compatible key. */
function filtersFor(q: RelatedQuery): Filters {
  const f: Filters = { ...EMPTY_FILTERS };
  const m = q.track ? metaOf(q.track) : undefined;
  if (q.by === "style" && m?.bpm) {
    f.bpmLo = Math.round(m.bpm * 0.94);
    f.bpmHi = Math.round(m.bpm * 1.06);
  }
  if (q.by === "bpm") {
    const b = Number(q.value);
    f.bpmLo = Math.round(b * 0.97);
    f.bpmHi = Math.round(b * 1.03);
  }
  if (q.by === "key") f.key = q.value;
  if (q.matchKey && m?.cam) f.key = m.cam;
  return f;
}

function relatedTitle(q: RelatedQuery) {
  switch (q.by) {
    case "style": return `Like “${q.value}”`;
    case "label": return q.value;
    case "genre": return q.value;
    case "year": return `${q.value}${q.track?.genre ? ` · ${q.track.genre}` : ""}`;
    case "bpm": return `~${q.value} BPM`;
    case "key": return `Mixes with ${q.value}`;
    case "artist": return q.value;
  }
}

const RELATED_KIND: Record<RelatedQuery["by"], string> = {
  style: "Similar songs",
  label: "Label",
  genre: "Genre",
  year: "Year",
  bpm: "Tempo",
  key: "Key",
  artist: "Artist",
};

/** History grouped by when you played it. */
function historyGroups(history: Played[]): Group[] {
  const day = 86400000;
  const start = new Date().setHours(0, 0, 0, 0);
  const buckets: [string, (at: number) => boolean][] = [
    ["Today", (at) => at >= start],
    ["Yesterday", (at) => at >= start - day && at < start],
    ["This week", (at) => at >= start - 7 * day && at < start - day],
    ["Earlier", (at) => at < start - 7 * day],
  ];
  return buckets
    .map(([label, test]) => ({ label, tracks: history.filter((h) => test(h.at)).map((h) => h.track) }))
    .filter((g) => g.tracks.length);
}

async function load(url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, body ? { method: "POST", body: JSON.stringify(body) } : undefined);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export default function Dashboard() {
  const { ready, profile, likedArtists, saved, update, account, history: played, clearHistory } = useProfile();
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
  const simple = profile.viewMode === "simple";
  useAnalysisVersion();
  useStylesVersion();
  const [view, setViewState] = useState<View>({ kind: "crates" });
  const prevView = useRef<View | null>(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Related views bring their own filters; leaving one clears them.
  const viewRef = useRef(view);
  viewRef.current = view;
  const setView = (v: View) => {
    const cur = viewRef.current;
    if (v.kind === "related") {
      if (cur.kind !== "related") prevView.current = cur;
      setFilters(filtersFor(v.q));
    } else if (cur.kind === "related") setFilters(EMPTY_FILTERS);
    viewRef.current = v;
    setViewState(v);
  };
  useEffect(() =>
    onRelated((q) => {
      if (q.track) requestStyles(q.track, true);
      setView({ kind: "related", q });
    }),
  );
  const [q, setQ] = useState("");
  const [fetched, setFetched] = useState<Group[] | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [showCrates, setShowCrates] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const enabled = useMemo(() => profile.crates.filter((c) => profile.enabled.includes(c.id)), [profile.crates, profile.enabled]);
  const viewCrates = view.kind === "crates" && view.crateId ? profile.crates.filter((c) => c.id === view.crateId) : enabled;
  const cratesKey = JSON.stringify(viewCrates.map((c) => [c.id, c.artists.length, c.years]));

  useEffect(() => {
    if (!ready || view.kind === "saved" || view.kind === "history") return;
    let body: unknown, url: string;
    if (view.kind === "related") {
      url = "/api/related";
      const { track, ...rest } = view.q;
      // Send the seed without bulky fields.
      // What the style model heard in the seed steers the deep-cut search.
      const styles = track ? getStyles(track.id)?.data?.top.filter((s) => s.score > 0.15).slice(0, 3).map((s) => s.name) : undefined;
      body = { ...rest, styles, track: track && { ...track, tags: [] }, exclude: profile.disliked, seed: String(nonce) };
    } else if (view.kind === "search") {
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
        const data = d as { tracks?: Track[]; known?: Track[]; deep?: Track[]; related?: { scene: string; tracks: Track[] } };
        const groups: Group[] = [];
        if (data.known) {
          if (data.known.length) groups.push({ label: "Known records", tracks: data.known });
        } else groups.push({ tracks: data.tracks ?? [] });
        if (data.related?.tracks.length) groups.push({ label: `Same scene · ${data.related.scene}`, tracks: data.related.tracks });
        if (data.deep?.length) groups.push({ label: "Deep cuts", note: DEEP_NOTE, tracks: data.deep });
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
        : view.kind === "history"
          ? historyGroups(played)
          : fetched,
    [view.kind, saved, fetched, played],
  );

  const all = useMemo(() => groups?.flatMap((g) => g.tracks) ?? [], [groups]);
  // Analyse everything in the view, not just what's shown, so BPM/key filters can let tracks in.
  useEffect(() => {
    for (const t of all) if (t.audioUrl && t.source !== "ccmixter" && t.source !== "soundcloud") requestAnalysis(t);
    for (const t of all) requestStyles(t);
  }, [all]);
  let waiting = 0;
  const seedId = view.kind === "related" ? view.q.track?.id : undefined;
  const filtered = groups?.map((g) => {
    const r = applyFilters(g.tracks, filters);
    waiting += r.waiting;
    // Related views: closest-sounding first, once the style model has heard them.
    const tracks = seedId ? r.shown.slice().sort((x, y) => (similarity(seedId, y.id) ?? -1) - (similarity(seedId, x.id) ?? -1)) : r.shown;
    return { ...g, tracks };
  });
  const shownCount = filtered?.reduce((n, g) => n + g.tracks.length, 0) ?? 0;
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of all) {
      const g = topStyle(t.id)?.name ?? t.genre;
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
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
    view.kind === "related"
      ? relatedTitle(view.q)
      : view.kind === "sc"
      ? view.name
      : view.kind === "search"
      ? `“${view.q}”`
      : view.kind === "saved"
        ? "Saved"
        : view.kind === "history"
        ? "History"
        : view.crateId
          ? profile.crates.find((c) => c.id === view.crateId)?.name ?? "Crate"
          : "For you";

  if (!ready) return null;

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-line px-3 sm:gap-4 sm:px-4">
        <span className="flex shrink-0 items-center gap-2 text-[14px] font-semibold tracking-tight">
          <span className="size-3 rounded-full bg-accent shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]" />
          <span className="hidden sm:inline">curator</span>
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
            placeholder="Search artists, songs…"
            className="h-8 w-full rounded-lg bg-white/[0.07] pl-9 pr-10 text-[13px] outline-none transition-shadow duration-200 placeholder:text-mute/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]"
          />
          <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded bg-white/[0.08] px-1.5 font-mono text-[10px] text-mute sm:block">/</kbd>
        </form>
        <div className={`ml-auto hidden gap-3 text-[11px] text-mute ${simple ? "" : "xl:flex"}`}>
          {[["Space", "play"], ["↑↓", "move"], ["↵", "details"], ["S", "save"], ["R", "random"], ["M", "mark"]].map(([k, v]) => (
            <span key={k}>
              <kbd className="mr-1 rounded bg-white/[0.08] px-1 font-mono text-[10px]">{k}</kbd>
              {v}
            </span>
          ))}
        </div>
        <div className={`ml-auto flex items-center gap-1 ${simple ? "" : "xl:ml-0"}`}>
        <RadioButton />
        <Link
          href="/settings"
          aria-label="Settings"
          title={account ? `Settings · signed in as ${account.email ?? "you"}` : "Settings · guest"}
          className="relative grid size-8 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-white/[0.08] hover:text-paper"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {account && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" />}
        </Link>
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
          {!simple && <FilterBar f={filters} set={setFilters} genres={genres} loopsAvailable={!!config?.freesound} />}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2 pt-1">
            {view.kind === "related" && (
              <button
                onClick={() => setView(prevView.current ?? { kind: "crates" })}
                className="grid size-7 place-items-center rounded-md text-mute transition-colors hover:bg-white/[0.08] hover:text-paper"
                aria-label="Back"
                title="Back"
              >
                ‹
              </button>
            )}
            <div className="min-w-0">
              {view.kind === "related" && <div className="label leading-none">{RELATED_KIND[view.q.by]}</div>}
              <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
            </div>
            <span className="text-[12px] text-mute">
              {groups ? `${shownCount}${filtersActive(filters) ? ` of ${all.length}` : ""} tracks` : "loading…"}
              {waiting > 0 && ` · ${waiting} still analysing`}
            </span>
            {view.kind === "related" && view.q.track && (view.q.by === "style" || view.q.by === "bpm") && (
              <button
                onClick={() => {
                  const cam = view.q.track && metaOf(view.q.track).cam;
                  if (!cam) return;
                  setFilters((f) => ({ ...f, key: f.key ? null : cam, keyMode: "compatible" }));
                }}
                disabled={!metaOf(view.q.track).cam}
                className={`btn ml-auto disabled:opacity-40 ${filters.key ? "btn-on" : ""}`}
                title="Only songs in a key that mixes with this one"
              >
                {filters.key ? `Key: ${filters.key} ✓` : "Match key"}
              </button>
            )}
            {view.kind === "sc" && all.length > 0 && (
              <button
                onClick={() => {
                  // Turn this playlist into a crate: its most frequent artists.
                  const counts = new Map<string, number>();
                  for (const t of all) if (!looksLikeLabel(t.artist)) counts.set(t.artist, (counts.get(t.artist) ?? 0) + 1);
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
            {view.kind === "history" && played.length > 0 && (
              <button
                onClick={() => confirm("Clear your play history?") && clearHistory()}
                className="btn ml-auto"
              >
                Clear history
              </button>
            )}
            {view.kind !== "saved" && view.kind !== "history" && (
              <button
                onClick={() => setNonce((n) => n + 1)}
                className={`btn ${(view.kind === "sc" && all.length > 0) || (view.kind === "related" && view.q.track && (view.q.by === "style" || view.q.by === "bpm")) ? "" : "ml-auto"}`}
              >
                ↻ Refresh
              </button>
            )}
          </div>
          {view.kind === "crates" && !profile.crates.length ? (
            <StarterCrates />
          ) : error ? (
            <div className="px-4 py-16 text-center text-mute">Couldn&apos;t load tracks. Hit refresh.</div>
          ) : filtered ? (
            <TrackTable
              groups={filtered}
              seedId={seedId}
              emptyText={
                all.length
                  ? waiting
                    ? "Analysing BPM and key… matches will appear here."
                    : "Nothing matches these filters."
                  : view.kind === "saved"
                    ? "Nothing saved yet. Press S on a track or hit the heart."
                    : view.kind === "history"
                    ? "Songs you play show up here."
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
