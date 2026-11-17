import type { Track } from "../types";
import { norm, type Scene } from "../scenes";

interface ItunesResult {
  kind?: string;
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
  trackViewUrl?: string;
  collectionId?: number;
  copyright?: string;
}

const cache = new Map<string, { at: number; data: ItunesResult[] }>();
const DAY = 86_400_000;

async function query(params: Record<string, string>): Promise<ItunesResult[]> {
  const qs = new URLSearchParams({ media: "music", entity: "song", country: "US", ...params });
  const key = qs.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.data;
  try {
    const res = await fetch(`https://itunes.apple.com/search?${key}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: ItunesResult[] };
    const data = (json.results ?? []).filter((r) => r.kind === "song" && r.previewUrl);
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return [];
  }
}

function cleanTitle(t: string) {
  return norm(t.replace(/\(.*?\)|\[.*?\]/g, "").replace(/ - .*$/, ""));
}

function toTrack(r: ItunesResult, scene?: string): Track {
  const year = r.releaseDate ? new Date(r.releaseDate).getUTCFullYear() : undefined;
  return {
    id: `it:${r.trackId}`,
    source: "itunes",
    type: "song",
    title: r.trackName,
    artist: r.artistName,
    year,
    genre: r.primaryGenreName,
    scene,
    artwork: r.artworkUrl100?.replace("100x100bb", "600x600bb"),
    audioUrl: r.previewUrl,
    previewOnly: true,
    durationSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : undefined,
    tags: [],
    pageUrl: r.trackViewUrl ?? "",
    albumId: r.collectionId,
  };
}

function dedupe(results: ItunesResult[]): ItunesResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const k = cleanTitle(r.trackName) + "|" + norm(r.artistName);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Songs by one artist, kept to the scene's era when the catalog dates allow. */
export async function songsByArtist(artist: string, scene?: Scene): Promise<Track[]> {
  const results = await query({ term: artist, attribute: "artistTerm", limit: "60" });
  const want = norm(artist);
  const byArtist = dedupe(
    results.filter((r) => {
      const a = norm(r.artistName);
      return a === want || a.includes(want) || (want.includes(a) && a.length > 3);
    }),
  );
  let kept = byArtist;
  if (scene) {
    const [lo, hi] = scene.years;
    const inEra = byArtist.filter((r) => {
      const y = r.releaseDate ? new Date(r.releaseDate).getUTCFullYear() : 0;
      return y >= lo && y <= hi + 2;
    });
    if (inEra.length >= 3) kept = inEra;
  }
  return kept.map((r) => toTrack(r, scene?.id));
}

export async function searchSongs(term: string, limit = 30): Promise<Track[]> {
  let results = await query({ term, limit: String(limit) });
  if (!results.length) {
    // iTunes rate-limits bursts; one gentle retry covers most interactive searches.
    await new Promise((r) => setTimeout(r, 1500));
    results = await query({ term, limit: String(limit) });
  }
  return dedupe(results).map((r) => toTrack(r));
}

/** "℗ 1986 Alleviated Records" → "Alleviated Records". */
export function labelFromCopyright(c?: string): string | undefined {
  if (!c) return undefined;
  // "This Compilation ℗ 2005 Jive Records": the label follows the ℗/© mark.
  const mark = c.search(/[℗©]|\(p\)|\(c\)/i);
  let s = (mark > 0 ? c.slice(mark) : c)
    .replace(/[℗©]|\(p\)|\(c\)/gi, " ")
    // "This compilation 1994 Sony Music…" without a mark.
    .replace(/^\s*(this\s+)?(compilation|album|record(ing)?)s?\s*/i, "")
    .replace(/^[\s\d,\-–]+/, "");
  s = s.split(/,| under (exclusive )?licen[cs]e| distributed by| marketed by| a division of|\. All rights/i)[0];
  s = s.replace(/\b(inc|ltd|llc|gmbh|corp|b\.?v|s\.?a|ag)\.?$/i, "").replace(/[\s.,]+$/, "").trim();
  // Catalog owners, not the label a record came out on.
  if (/^(originally|recorded|released|remaster)/i.test(s) || /\b(19|20)\d\d$/.test(s)) return undefined;
  if (/^(umg recordings|universal music.*|sony music entertainment.*|warner music.*|bmg rights management.*|concord.*)$/i.test(s)) return undefined;
  return s.length > 1 && s.length < 60 && !/^\d+$/.test(s) ? s : undefined;
}

const labels = new Map<number, string | null>();

/** Fills in record labels from Apple's album details, in one batched lookup. */
export async function withLabels(tracks: Track[]): Promise<Track[]> {
  const missing = [...new Set(tracks.filter((t) => t.albumId && !t.label && !labels.has(t.albumId)).map((t) => t.albumId!))];
  for (let i = 0; i < missing.length; i += 150) {
    const ids = missing.slice(i, i + 150);
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${ids.join(",")}&country=US`, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { results?: { collectionId?: number; copyright?: string; wrapperType?: string }[] };
      for (const r of json.results ?? []) if (r.collectionId) labels.set(r.collectionId, labelFromCopyright(r.copyright) ?? null);
      for (const id of ids) if (!labels.has(id)) labels.set(id, null);
    } catch {}
  }
  return tracks.map((t) => (t.albumId && !t.label && labels.get(t.albumId) ? { ...t, label: labels.get(t.albumId)! } : t));
}

/** The iTunes preview for a specific record, if Apple has it. */
export async function findPreview(artist: string, title: string): Promise<Track | null> {
  const results = await query({ term: `${artist} ${title}`.slice(0, 100), limit: "8" });
  const a = norm(artist), tt = cleanTitle(title);
  const hit = results.find((r) => {
    const ra = norm(r.artistName), rt = cleanTitle(r.trackName);
    return (ra === a || ra.includes(a) || a.includes(ra)) && (rt === tt || rt.startsWith(tt) || tt.startsWith(rt));
  });
  return hit ? toTrack(hit) : null;
}
