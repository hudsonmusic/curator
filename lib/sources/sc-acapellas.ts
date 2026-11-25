import { unstable_cache } from "next/cache";
import { ScSession, scConfigured, scToTrack, type ScToken, type ScTrack } from "./soundcloud";
import { norm } from "../scenes";
import type { Track } from "../types";

/**
 * Acapellas from SoundCloud. They're searched and streamed with curator's own app
 * token (SoundCloud's client-credentials sign-in), so they play for everyone,
 * whether or not they've connected their own SoundCloud.
 */

/** curator's app token. Cached across server instances (SoundCloud limits how many we may ask for). */
const appToken = unstable_cache(
  async (): Promise<ScToken | null> => {
    if (!scConfigured()) return null;
    const basic = Buffer.from(`${process.env.SOUNDCLOUD_CLIENT_ID}:${process.env.SOUNDCLOUD_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://secure.soundcloud.com/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json; charset=utf-8",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[soundcloud] app token → ${res.status}`);
      return null;
    }
    const j = (await res.json()) as { access_token: string; expires_in?: number };
    return { access: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  },
  ["sc-app-token-v1"],
  { revalidate: 45 * 60 },
);

export async function appSession(): Promise<ScSession | null> {
  const tok = await appToken().catch(() => null);
  return tok && tok.exp > Date.now() + 60_000 ? new ScSession(tok) : null;
}

const ACAPELLA = /\b(a\s?c+ap+el+as?|acapela|vocals? only|dry vocals?|vocal stems?|vox only)\b/i;
const NOT_ONE = /\b(remix|remake|bootleg|mashup|edit|flip|rework|cover|instrumental|beat|type beat|vs\.?|blend)\b/i;
/** "(Acapella)", "[acapella 92 bpm]", "- Acapella" and the like, taken off the title. */
const TAG = /\s*(?:[([][^)\]]*\b(?:a\s?c+ap+el+as?|acapela|vocals? only|dry vocals?)\b[^)\]]*[)\]]|[-–|]\s*(?:a\s?c+ap+el+as?|acapela|vocals? only|dry vocals?)\b.*$|\b(?:a\s?c+ap+el+as?|acapela)\b)/gi;

const stripTag = (s: string) => s.replace(TAG, "").replace(/\s{2,}/g, " ").replace(/^[\s\-–|]+|[\s\-–|]+$/g, "").trim();

/**
 * Reads "Artist - Song (Acapella)" or "Song - Artist" out of an upload's title.
 * `hint` is the artist being searched for; it decides which side is the artist.
 * Returns null when the title doesn't name that artist on its own.
 */
function parseTitle(raw: string, uploader: string, hint: string): { artist: string; title: string } | null {
  const clean = stripTag(
    raw
      .replace(/\b\d{2,3}\s?bpm\b/gi, "")
      .replace(/\s*\[[^\]]*\]/g, "") // [FREE DOWNLOAD], [Key: Am]…
      .replace(/\.(mp3|wav|aiff?|flac|m4a)\b/gi, "")
      .replace(/\s*\(\d\)/g, "")
      .replace(/\b[\w-]+\.(com|net|org|co|io|me)\b/gi, "")
      .replace(/\b(free\s*(download|dl)|dl\s*link|download\s*link|(link\s*)?in\s*(the\s*)?description|buy\s*link|out\s*now|\+\s*dl)\b/gi, "")
      .replace(/\s*\([^)]*\b(free|download|dl|out now|key)\b[^)]*\)/gi, "")
      .replace(/\s*[([]\s*[)\]]/g, ""),
  );
  const parts = clean.split(/\s+[-–—|]\s+/).map((x) => x.trim()).filter(Boolean);
  const h = norm(hint);
  // The artist as its own part of the title ("Nas - …"), or as the uploader.
  const isArtist = (x: string) => {
    const n = norm(x.replace(/\b(feat|ft)\.?\b.*$/i, ""));
    return n === h || n.startsWith(`${h} and `) || n.startsWith(`${h} x `);
  };
  if (h && parts.length >= 2) {
    const i = parts.findIndex(isArtist);
    if (i >= 0) return { artist: parts[i], title: parts.filter((_, j) => j !== i).join(" - ") };
  }
  if (h && isArtist(uploader)) return { artist: uploader, title: clean };
  if (h) return null;
  return parts.length >= 2 ? { artist: parts[0], title: parts.slice(1).join(" - ") } : { artist: uploader, title: clean };
}

function toAcapella(t: ScTrack, who: { artist: string; title: string }): Track {
  const track = scToTrack(t);
  const bpm = (t.title ?? "").match(/\b(\d{2,3})\s?bpm\b/i);
  return {
    ...track,
    id: `sca:${t.id}`,
    type: "acapella",
    artist: who.artist,
    title: who.title || track.title,
    tags: ["acapella"],
    sourceBpm: track.sourceBpm ?? (bpm && +bpm[1] >= 60 && +bpm[1] <= 200 ? +bpm[1] : undefined),
  };
}

/**
 * Acapellas from SoundCloud. With `artist`, only uploads that name that artist on
 * their own ("Nas - …") are kept; otherwise every word of the query must appear.
 * Remixes, mashups and the like are dropped.
 */
export async function scAcapellas(query: string, opts: { artist?: string; limit?: number; loose?: boolean } = {}): Promise<Track[]> {
  const sc = await appSession();
  if (!sc) return [];
  // SoundCloud's search mostly ignores the word "acapella", so also ask by tag; the
  // title check below keeps only real acapellas.
  const q = encodeURIComponent(query);
  const urls = [
    `/tracks?q=${encodeURIComponent(`${query} acapella`)}&limit=50&access=playable`,
    `/tracks?q=${q}&tags=${encodeURIComponent("acapella,acappella,a cappella,accapella,acapellas")}&limit=50&access=playable`,
  ];
  const pages = await Promise.all(
    urls.map((u) =>
      sc
        .get<ScTrack[] | { collection: ScTrack[] }>(u)
        .then((r) => (Array.isArray(r) ? r : r.collection))
        .catch(() => [] as ScTrack[]),
    ),
  );
  const ids = new Set<number>();
  const list = pages.flat().filter((t) => !ids.has(t.id) && (ids.add(t.id), true));
  const artist = opts.artist?.split(/,|&| feat\.? | ft\.? /i)[0].trim() ?? "";
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  const seen = new Set<string>();
  const out: Track[] = [];
  const loose: Track[] = [];
  for (const t of list) {
    const raw = t.title ?? "";
    if (!ACAPELLA.test(raw) || NOT_ONE.test(raw) || t.access === "blocked") continue;
    // 20 seconds to 10 minutes: skips one-shot tags and full DJ mixes.
    if (t.duration && (t.duration < 20_000 || t.duration > 600_000)) continue;
    const uploader = t.user?.username ?? "";
    let who = parseTitle(raw, uploader, artist);
    if (!who) continue;
    let strict = true;
    if (!artist) {
      const hay = ` ${norm(`${raw} ${uploader}`)} `;
      // `loose` (magic search by style or mood): SoundCloud's own matching decides.
      if (!opts.loose && words.length && !words.every((w) => hay.includes(` ${w} `))) continue;
      // A search that's an artist's name: uploads naming them on their own come first.
      const named = parseTitle(raw, uploader, query);
      if (named) who = named;
      else strict = false;
    }
    const a = toAcapella(t, who);
    const key = norm(`${a.artist} ${a.title}`);
    if (seen.has(key)) continue;
    seen.add(key);
    (strict ? out : loose).push(a);
  }
  const limit = opts.limit ?? 12;
  // When the search clearly is an artist, leave out uploads that only mention the word.
  return (out.length >= 3 ? out : [...out, ...loose]).slice(0, limit);
}

/**
 * A SoundCloud upload of a specific record (for records Apple doesn't have):
 * the title must match and the artist must be in the title or be the uploader.
 * Mixes, remixes and edits of it don't count.
 */
export async function scFindRecord(artist: string, title: string): Promise<Track | null> {
  const sc = await appSession();
  if (!sc) return null;
  const want = norm(title.replace(/\s*[([].*?[)\]]/g, ""));
  const who = norm(artist.split(/,|&| feat\.? | ft\.? /i)[0]);
  if (want.length < 2 || who.length < 2) return null;
  let list: ScTrack[] = [];
  try {
    const r = await sc.get<ScTrack[] | { collection: ScTrack[] }>(`/tracks?q=${encodeURIComponent(`${artist} ${title}`)}&limit=10&access=playable`);
    list = Array.isArray(r) ? r : r.collection;
  } catch {
    return null;
  }
  for (const t of list) {
    const raw = t.title ?? "";
    const n = norm(raw);
    if (!n.includes(want) || /\b(remix|edit|rework|bootleg|mix(ed)? by|dj mix|cover|live)\b/i.test(raw.replace(title, ""))) continue;
    if (!` ${n} ${norm(t.user?.username ?? "")} `.includes(` ${who} `)) continue;
    if (t.duration && (t.duration < 60_000 || t.duration > 900_000)) continue;
    const track = scToTrack(t);
    return track.audioUrl ? track : null;
  }
  return null;
}
