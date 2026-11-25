import type { Track } from "../types";
import { norm, type Scene } from "../scenes";

/**
 * Deezer's public catalog: the fallback when Apple turns curator away (Apple allows
 * about 20 searches a minute per server; Deezer allows far more). No key needed.
 */
interface DzTrack {
  id: number;
  title: string;
  title_version?: string;
  duration?: number;
  preview?: string;
  link?: string;
  artist: { name: string };
  album?: { title?: string; cover_xl?: string; cover_big?: string };
}

async function search(q: string, limit: number): Promise<DzTrack[]> {
  try {
    const res = await fetch(`https://api.deezer.com/search?${new URLSearchParams({ q, limit: String(limit) })}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: DzTrack[] };
    return (json.data ?? []).filter((t) => t.preview);
  } catch {
    return [];
  }
}

function toTrack(t: DzTrack, scene?: string): Track {
  return {
    id: `dz:${t.id}`,
    source: "deezer",
    type: "song",
    title: t.title,
    artist: t.artist.name,
    scene,
    artwork: t.album?.cover_xl ?? t.album?.cover_big,
    // Deezer's preview links expire after 15 minutes; this route fetches a fresh one.
    audioUrl: `/api/deezer/${t.id}`,
    previewOnly: true,
    durationSec: t.duration,
    tags: [],
    pageUrl: t.link ?? `https://www.deezer.com/track/${t.id}`,
  };
}

const sameArtist = (a: string, want: string) => {
  const x = norm(a);
  return x === want || x.includes(want) || (want.includes(x) && x.length > 3);
};

/** Songs by one artist (Deezer doesn't say the year, so there's no era filter). */
export async function dzSongsByArtist(artist: string, scene?: Scene): Promise<Track[]> {
  const want = norm(artist);
  const seen = new Set<string>();
  return (await search(`artist:"${artist}"`, 60).then((r) => (r.length ? r : search(artist, 60))))
    .filter((t) => sameArtist(t.artist.name, want))
    .filter((t) => {
      const k = norm(t.title.replace(/\(.*?\)|\[.*?\]/g, ""));
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .map((t) => toTrack(t, scene?.id));
}

/** The Deezer preview for a specific record, if it has one. */
export async function dzFindPreview(artist: string, title: string): Promise<Track | null> {
  const want = norm(artist), tt = norm(title.replace(/\(.*?\)|\[.*?\]/g, ""));
  const hit = (await search(`${artist} ${title}`.slice(0, 100), 8)).find((t) => {
    const rt = norm(t.title.replace(/\(.*?\)|\[.*?\]/g, ""));
    return sameArtist(t.artist.name, want) && (rt === tt || rt.startsWith(tt) || tt.startsWith(rt));
  });
  return hit ? toTrack(hit) : null;
}

/** A fresh preview link for a Deezer track. */
export async function dzPreviewUrl(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.deezer.com/track/${id}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { preview?: string };
    return json.preview || null;
  } catch {
    return null;
  }
}

/** A plain search, for when Apple's search is refusing. */
export async function dzSearch(term: string, limit = 30): Promise<Track[]> {
  return (await search(term, limit)).map((t) => toTrack(t));
}
