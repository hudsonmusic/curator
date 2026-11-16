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
