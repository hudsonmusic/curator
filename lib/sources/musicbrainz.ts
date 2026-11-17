import type { Track } from "../types";

/**
 * MusicBrainz: an open database of releases, including obscure 12"s and small labels
 * that streaming catalogs barely list. Used for deep cuts. No key needed, but it asks
 * for at most one request a second and an identifying User-Agent.
 */
const UA = "curator/0.1 (personal sample finder)";
const DAY = 86_400_000;

interface MbRelease {
  id: string;
  title: string;
  date?: string;
  "artist-credit"?: { name: string; artist?: { name: string } }[];
  "label-info"?: { label?: { name?: string } }[];
  "release-group"?: { "primary-type"?: string };
  media?: { format?: string }[];
  tags?: { name: string }[];
}

let last = 0;
let chain: Promise<unknown> = Promise.resolve();
const cache = new Map<string, { at: number; data: { count: number; releases: MbRelease[] } }>();

/** Queues requests one per ~1.1 s across the whole server. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

export async function searchReleases(query: string, limit = 100, offset = 0): Promise<{ count: number; releases: MbRelease[] }> {
  const qs = new URLSearchParams({ query, fmt: "json", limit: String(limit), offset: String(offset) });
  const key = qs.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.data;
  try {
    const data = await throttled(async () => {
      const res = await fetch(`https://musicbrainz.org/ws/2/release?${key}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as { count: number; releases: MbRelease[] };
    });
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return { count: 0, releases: [] };
  }
}

const q = (s: string) => `"${s.replace(/["\\]/g, "")}"`;

export const mbQuery = {
  tags: (tags: string[]) => `(${tags.map((t) => `tag:${q(t)}`).join(" OR ")})`,
  years: (lo: number, hi: number) => (lo === hi ? `date:${lo}` : `date:[${lo} TO ${hi}]`),
  label: (name: string) => `label:${q(name)}`,
  vinyl: `format:"12\\" Vinyl"`,
};

/** One release as a playable-ish track: the A-side of a 12", or the title track. */
export function releaseToTrack(r: MbRelease, scene?: string): Track | null {
  const artist = r["artist-credit"]?.map((a) => a.name).join(" & ");
  if (!artist || /^various artists$/i.test(artist)) return null;
  // Albums and catch-all EP titles ("E.P.", "Collectors Edition") don't name a track.
  if (r["release-group"]?.["primary-type"] === "Album") return null;
  if (/^(e\.?p\.?|lp|ep \d+|the e\.?p\.?)$|\b(lp|album|collection|collectors|edition|sampler|soundtracks?|vol(\.|ume)\s*\d+|anthology|greatest|best of)\b|\.\.\.$/i.test(r.title.trim())) return null;
  const aSide = r.title.split(/\s+\/\s+/)[0].trim();
  const year = r.date ? Number(r.date.slice(0, 4)) || undefined : undefined;
  const label = r["label-info"]?.map((l) => l.label?.name).find((n) => n && !/^(\[no label\]|none|not on label.*|self-released)$/i.test(n));
  return {
    id: `mb:${r.id}`,
    source: "musicbrainz",
    type: "song",
    title: aSide,
    artist,
    year,
    genre: r.tags?.[0]?.name ? r.tags[0].name.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined,
    scene,
    previewOnly: true,
    tags: r.tags?.map((t) => t.name) ?? [],
    pageUrl: `https://musicbrainz.org/release/${r.id}`,
    label,
    deep: true,
  };
}
