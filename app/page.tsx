"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RelatedQuery, Track } from "@/lib/types";
import { useProfile, type Played } from "@/lib/profile";
import { useConfig } from "@/lib/config";
import { requestAnalysis, useAnalysisVersion } from "@/lib/analysis-store";
import { requestStyles, similarity, topStyle, useStylesVersion, getStyles, waitForStyles } from "@/lib/style-store";
import { CratesPanel, type View } from "@/components/crates-panel";
import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { RandomPick } from "@/components/random-pick";
import { TrackTable, type Group } from "@/components/track-table";
import { EMPTY_FILTERS, applyFilters, filtersActive, metaOf, type Filters } from "@/components/meta";
import { onRelated } from "@/components/related";
import { StarterCrates } from "@/components/starter-crates";
import { RadioButton } from "@/components/radio";
import { ShortcutsButton } from "@/components/shortcuts";
import { SeedHeader } from "@/components/seed-header";
import { MagicButton, MagicDialog, MagicIcon } from "@/components/magic-search";
import type { MagicPlan } from "@/lib/magic";
import { camelotOf } from "@/lib/keys";
import { isMusicLink } from "@/lib/link";
import { embB64 } from "@/lib/sound-sync";
import { LinkAutoplay } from "@/components/link-autoplay";
import { norm } from "@/lib/scenes";
import { looksLikeLabel } from "@/lib/sc-names";

const cache = new Map<string, Group[]>();
const magicPlans = new Map<string, MagicPlan>();
const SOUND_LABEL = "Sounds like this";
/** Views you step into from another list, with a back arrow. */
const stepAside = (v: View) => v.kind === "related" || v.kind === "magic" || v.kind === "link";

/** Filters a magic search starts with: its tempo and key. */
function filtersForPlan(p: MagicPlan): Filters {
  const f: Filters = { ...EMPTY_FILTERS };
  if (p.bpm) {
    f.bpmLo = p.bpm[0];
    f.bpmHi = p.bpm[1];
  }
  const cam = p.key ? (/^\d{1,2}[AB]$/.test(p.key) ? p.key : camelotOf(p.key)) : null;
  if (cam) {
    f.key = cam;
    f.keyMode = "compatible";
  }
  return f;
}

/** How well a track's heard styles match what was asked for (0 when unknown). */
function styleMatch(id: string, styles: string[]) {
  const top = getStyles(id)?.data?.top;
  if (!top || !styles.length) return 0;
  const want = new Set(styles.map((s) => s.toLowerCase()));
  return top.reduce((sum, s) => sum + (want.has(s.name.toLowerCase()) ? s.score : 0), 0);
}

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

type ApiResult = {
  tracks?: Track[];
  known?: Track[];
  deep?: Track[];
  acapellas?: Track[];
  plan?: MagicPlan;
  similar?: Track[];
  /** Opened links: what it is, or why it could not be opened. */
  name?: string;
  error?: string;
  related?: { scene: string; tracks: Track[] };
};

/** An API answer as the list's sections. */
function toGroups(data: ApiResult): Group[] {
  const groups: Group[] = [];
  if (data.similar?.length) groups.push({ label: SOUND_LABEL, note: "Closest by sound, from every song curator has heard", tracks: data.similar });
  if (data.known) {
    if (data.known.length) groups.push({ label: "Known records", tracks: data.known });
  } else groups.push({ tracks: data.tracks ?? [] });
  if (data.related?.tracks.length) groups.push({ label: `Same scene · ${data.related.scene}`, tracks: data.related.tracks });
  if (data.deep?.length) groups.push({ label: "Deep cuts", note: DEEP_NOTE, tracks: data.deep });
  if (data.acapellas?.length) groups.push({ label: "Acapellas", note: "From SoundCloud", tracks: data.acapellas });
  return groups;
}

/** Sections mixed together (known, deep cut, acapella, known…) for the batches that follow. */
function interleave(groups: Group[]): Track[] {
  const lists = groups.map((g) => [...g.tracks]);
  const out: Track[] = [];
  const seen = new Set<string>();
  while (lists.some((l) => l.length)) {
    for (const l of lists) {
      const t = l.shift();
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
  }
  return out;
}

/**
 * The bottom of an endless list: loads the next batch as it comes into view (a
 * little before, so it's ready), and keeps going while it stays in view, up to a few
 * batches at a time (filters can hide most of what comes back).
 */
function EndlessFooter({ state, onMore }: { state: "idle" | "loading" | "done"; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useRef(false);
  const chained = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        if (e.isIntersecting) {
          chained.current = 0;
          onMoreRef.current();
        }
      },
      { rootMargin: "0px 0px 900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const onMoreRef = useRef(onMore);
  onMoreRef.current = onMore;
  // Still at the bottom after a batch arrived (everything filtered out, or a short batch): keep digging.
  useEffect(() => {
    if (state !== "idle" || !visible.current || chained.current >= 3) return;
    chained.current++;
    const id = setTimeout(() => onMoreRef.current(), 300);
    return () => clearTimeout(id);
  }, [state]);
  return (
    <div ref={ref} className="flex flex-col items-center gap-2 px-4 pb-6 pt-4 text-[12px] text-mute">
      {state === "loading" ? (
        <span className="flex items-center gap-2">
          <span className="size-3 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
          Digging up more…
        </span>
      ) : state === "done" ? (
        <>
          <span>That&apos;s everything curator could find from here.</span>
        </>
      ) : (
        <button onClick={onMore} className="btn rounded-full px-4">
          Dig up more
        </button>
      )}
    </div>
  );
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
      if (!stepAside(cur)) prevView.current = cur;
      setFilters(filtersFor(v.q));
    } else if (v.kind === "magic" || v.kind === "link") {
      if (!stepAside(cur)) prevView.current = cur;
      setFilters(EMPTY_FILTERS); // a magic search sets its own once the plan arrives
    } else if (stepAside(cur)) setFilters(EMPTY_FILTERS);
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
  const [magicPlan, setMagicPlan] = useState<MagicPlan | null>(null);
  const [magicOpen, setMagicOpen] = useState(false);
  const [opened, setOpened] = useState<{ tracks: Track[] } | null>(null);
  const [linkName, setLinkName] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const openLink = (url: string) => {
    setQ("");
    setLinkName(null);
    setView({ kind: "link", url: url.trim() });
    searchRef.current?.blur();
  };
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [showCrates, setShowCrates] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const enabled = useMemo(() => profile.crates.filter((c) => profile.enabled.includes(c.id)), [profile.crates, profile.enabled]);
  const viewCrates = view.kind === "crates" && view.crateId ? profile.crates.filter((c) => c.id === view.crateId) : enabled;
  const cratesKey = JSON.stringify(viewCrates.map((c) => [c.id, c.artists.length, c.years]));

  /** The request for a view; `page` > 0 asks for more, skipping `exclude`. */
  const requestFor = (page: number, exclude: string[]): { url: string; body?: unknown } | null => {
    const p = page ? `:p${page}` : "";
    if (view.kind === "saved" || view.kind === "history") return null;
    const relatedTo = (q: RelatedQuery) => {
      const { track, ...rest } = q;
      // Send the seed without bulky fields. Its fingerprint searches the shared sound
      // index; the styles the model heard steer the deep-cut search.
      const heard = track ? getStyles(track.id)?.data : undefined;
      const styles = heard?.top.filter((s) => s.score > 0.15).slice(0, 3).map((s) => s.name);
      const emb = heard ? embB64(heard.emb) : undefined;
      return { url: "/api/related", body: { ...rest, styles, emb, track: track && { ...track, tags: [] }, exclude, seed: `${nonce}${p}` } };
    };
    if (view.kind === "related") return relatedTo(view.q);
    if (view.kind === "link") {
      if (!page) return { url: `/api/link?url=${encodeURIComponent(view.url)}` };
      // Below a link: songs like it.
      const seed = opened?.tracks[0];
      return seed ? relatedTo({ by: "style", value: seed.title, track: seed }) : null;
    }
    if (view.kind === "magic") return { url: "/api/magic", body: { q: view.q, exclude, seed: `${view.q}:${nonce}${p}` } };
    if (view.kind === "search") return page ? null : { url: `/api/search?q=${encodeURIComponent(view.q)}&type=all` };
    if (view.kind === "sc") {
      if (page) return null;
      return { url: view.id === "likes" ? `/api/soundcloud/likes?n=${nonce}` : `/api/soundcloud/playlists/${view.id}?n=${nonce}` };
    }
    return {
      url: "/api/crate",
      body: {
        crates: viewCrates,
        types: ["song", "acapella", "loop"],
        weights: profile.sceneWeights,
        likedArtists,
        exclude,
        seed: `${new Date().toISOString().slice(0, 10)}:${nonce}:${view.crateId ?? "all"}${p}`,
        size: 32,
      },
    };
  };
  /** Endless lists: crates, For you, magic search and related keep digging. */
  const endless = view.kind === "crates" || view.kind === "magic" || view.kind === "related" || view.kind === "link";
  /** The song a related list (or an opened link) starts from. */
  const seedTrack = view.kind === "related" ? view.q.track : view.kind === "link" ? opened?.tracks[0] : undefined;
  const [extra, setExtra] = useState<Track[][]>([]);
  const [more, setMore] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    setExtra([]);
    setMore("idle");
    if (!ready || !requestFor(0, profile.disliked)) return;
    let cancelled = false;
    setLinkError(null);
    setFetched(null);
    setError(false);
    void (async () => {
      // Similar songs search by sound: let the seed be heard first (a few seconds).
      if (view.kind === "related" && view.q.track && view.q.by === "style") await waitForStyles(view.q.track, 15000);
      if (cancelled) return;
      const { url, body } = requestFor(0, profile.disliked)!;
      const key = url + JSON.stringify(body ?? "") + cratesKey;
      const hit = view.kind === "link" ? undefined : cache.get(key);
      if (hit) {
        const plan = magicPlans.get(key);
        setMagicPlan(plan ?? null);
        if (plan) setFilters(filtersForPlan(plan));
        return setFetched(hit);
      }
      load(url, body)
      .then((d) => {
        const data = d as ApiResult;
        if (data.plan) {
          magicPlans.set(key, data.plan);
          if (!cancelled) {
            setMagicPlan(data.plan);
            setFilters(filtersForPlan(data.plan));
          }
        }
        const groups = toGroups(data);
        if (view.kind === "link") {
          if (cancelled) return;
          setLinkError(data.error ?? null);
          setLinkName(data.name ?? null);
          setOpened({ tracks: data.tracks ?? [] });
        } else cache.set(key, groups);
        if (!cancelled) setFetched(groups);
      })
      .catch(() => !cancelled && setError(true));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, nonce, cratesKey]);

  // Fetch the next batch: new picks, skipping everything already in the list.
  const viewToken = useRef(0);
  useEffect(() => {
    viewToken.current++;
  }, [view, nonce, cratesKey]);
  const loadMore = async () => {
    if (!endless || !fetched || more !== "idle") return;
    const token = viewToken.current;
    setMore("loading");
    const listed = [...fetched.flatMap((g) => g.tracks), ...extra.flat()];
    const shown = new Set(listed.map((t) => t.id));
    // The same record can come back under another id (another pressing, another source).
    const songKey = (t: Track) => `${norm(t.artist)}|${norm(t.title.replace(/\s*[([].*?[)\]]/g, ""))}`;
    const shownSongs = new Set(listed.map(songKey));
    if (seedTrack) await waitForStyles(seedTrack, 15000);
    if (token !== viewToken.current) return;
    let fresh: Track[] = [];
    // A batch can come back all repeats; try the next one before giving up.
    for (let tries = 0, page = extra.length + 1; tries < 2 && !fresh.length; tries++, page++) {
      const req = requestFor(page, [...profile.disliked, ...shown].slice(-1500));
      if (!req) break;
      try {
        const got = toGroups((await load(req.url, req.body)) as ApiResult);
        // Sound matches keep their order (closest first); the rest are mixed in after.
        const bySound = got[0]?.label === SOUND_LABEL ? got.shift()!.tracks : [];
        fresh = [...bySound, ...interleave(got)].filter((t) => {
          const k = songKey(t);
          if (shown.has(t.id) || shownSongs.has(k)) return false;
          shownSongs.add(k);
          return true;
        });
      } catch {
        break;
      }
      if (token !== viewToken.current) return; // you moved on
    }
    if (token !== viewToken.current) return;
    if (fresh.length) {
      setExtra((e) => [...e, fresh]);
      setMore("idle");
    } else setMore("done");
  };
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  const groups: Group[] | null = useMemo(
    () =>
      view.kind === "saved"
        ? [{ tracks: Object.values(saved).sort((a, b) => b.savedAt - a.savedAt).map((s) => s.track) }]
        : view.kind === "history"
          ? historyGroups(played)
          : fetched && [...fetched, ...extra.map((tracks, i) => ({ label: i === 0 ? (view.kind === "link" ? "Sounds like this" : "More finds") : undefined, note: i === 0 ? (view.kind === "link" ? "Closest by sound first, then more digging" : "Keeps digging as you scroll") : undefined, tracks }))],
    [view.kind, saved, fetched, played, extra],
  );

  const all = useMemo(() => groups?.flatMap((g) => g.tracks) ?? [], [groups]);
  // Analyse everything in the view, not just what's shown, so BPM/key filters can let tracks in.
  useEffect(() => {
    for (const t of all) if (t.audioUrl) requestAnalysis(t);
    for (const t of all) requestStyles(t);
  }, [all]);
  let waiting = 0;
  const seedId = seedTrack?.id;
  const filtered = groups?.map((g) => {
    const r = applyFilters(g.tracks, filters);
    waiting += r.waiting;
    // Related views: closest-sounding first, once the style model has heard them.
    // Magic search: the ones that sound most like the styles asked for first.
    const want = view.kind === "magic" ? magicPlan?.styles ?? [] : [];
    const tracks = seedId
      ? r.shown.slice().sort((x, y) => (similarity(seedId, y.id) ?? y.match ?? -1) - (similarity(seedId, x.id) ?? x.match ?? -1))
      : want.length
        ? r.shown.slice().sort((x, y) => styleMatch(y.id, want) - styleMatch(x.id, want))
        : r.shown;
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
    view.kind === "link"
      ? linkName ?? (linkError ? "Couldn't open that link" : "Opening link…")
      : view.kind === "magic"
      ? `“${view.q}”`
      : view.kind === "related"
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
      <LinkAutoplay opened={opened} />
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-line px-3 sm:gap-4 sm:px-4">
        <span className="flex shrink-0 items-center gap-2 text-[14px] font-semibold tracking-tight">
          <span className="size-3 rounded-full bg-accent shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]" />
          <span className="hidden sm:inline">curator</span>
        </span>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = q.trim();
            if (isMusicLink(v)) return openLink(v);
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
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (!isMusicLink(text)) return;
              e.preventDefault();
              openLink(text);
            }}
            onKeyDown={(e) => e.key === "Escape" && searchRef.current?.blur()}
            placeholder="Search, or paste a YouTube or SoundCloud link…"
            className="h-8 w-full rounded-lg bg-white/[0.07] pl-9 pr-16 text-[13px] outline-none transition-shadow duration-200 placeholder:text-mute/70 focus:bg-white/[0.09] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]"
          />
          <kbd className="absolute right-10 top-1/2 hidden -translate-y-1/2 rounded bg-white/[0.08] px-1.5 font-mono text-[10px] text-mute sm:block">/</kbd>
          <MagicButton onClick={() => setMagicOpen(true)} className="absolute right-1 top-1/2 -translate-y-1/2" />
        </form>
        <MagicDialog
          open={magicOpen}
          onClose={() => setMagicOpen(false)}
          ai={!!config?.magicAi}
          onSearch={(text) => {
            setMagicOpen(false);
            setQ("");
            setView({ kind: "magic", q: text });
          }}
        />
        <div className="ml-auto flex items-center gap-1">
        <ShortcutsButton />
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
          {/* Random picks belong to your crates; elsewhere it stays out of the way (R still rolls one). */}
          <RandomPick crates={enabled} decades={filters.decades} hidden={view.kind !== "crates"} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2 pt-3">
            {stepAside(view) && (
              <button
                onClick={() => setView(prevView.current ?? { kind: "crates" })}
                className="grid size-7 place-items-center rounded-md text-mute transition-colors hover:bg-white/[0.08] hover:text-paper"
                aria-label="Back"
                title="Back"
              >
                ‹
              </button>
            )}
            {view.kind === "related" && view.q.by === "style" && view.q.track ? (
              <SeedHeader track={view.q.track} />
            ) : (
            <div className="min-w-0">
              {view.kind === "related" && <div className="label leading-none">{RELATED_KIND[view.q.by]}</div>}
              {view.kind === "magic" && (
                <div className="label flex items-center gap-1 leading-none">
                  <MagicIcon className="size-3 text-accent" /> Magic search
                </div>
              )}
              <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
            </div>
            )}
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
            {view.kind !== "saved" && view.kind !== "history" && view.kind !== "link" && (
              <button
                onClick={() => setNonce((n) => n + 1)}
                className={`btn ${(view.kind === "sc" && all.length > 0) || (view.kind === "related" && view.q.track && (view.q.by === "style" || view.q.by === "bpm")) ? "" : "ml-auto"}`}
              >
                ↻ Refresh
              </button>
            )}
          </div>
          {view.kind === "magic" && magicPlan && (
            <div className="fade-up flex flex-wrap items-center gap-1.5 px-4 pb-3 text-[12px]">
              <span className="text-mute">Understood as</span>
              {magicPlan.summary.split(" · ").map((part) => (
                <span key={part} className="rounded-full bg-accent/15 px-2.5 py-0.5 text-paper/90">
                  {part}
                </span>
              ))}
              <button onClick={() => setMagicOpen(true)} className="ml-1 text-mute underline-offset-2 hover:text-paper hover:underline">
                Change
              </button>
              {magicPlan.via === "ai" && <span className="text-[11px] text-mute">· read by Claude</span>}
            </div>
          )}
          {!simple && !(view.kind === "crates" && !profile.crates.length) && (
            <FilterBar f={filters} set={setFilters} genres={genres} loopsAvailable={!!config?.freesound} />
          )}
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
                  : view.kind === "link"
                    ? linkError ?? "Nothing found at that link."
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
          {endless && fetched && all.length > 0 && <EndlessFooter state={more} onMore={() => void loadMoreRef.current()} />}
        </main>
      </div>
    </div>
  );
}
