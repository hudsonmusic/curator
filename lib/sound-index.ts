import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Track } from "./types";
import { norm } from "./scenes";

/**
 * The shared sound index (server only): a Discogs-EffNet fingerprint for every song
 * anyone's curator has listened to, searchable by sound. Lives in the `sounds` table
 * in Supabase (pgvector); see supabase/schema.sql.
 */
let client: SupabaseClient | null = null;
export function indexEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
function db() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return client;
}

export const songKey = (artist: string, title: string) =>
  `${norm(artist.split(/,|&| feat\.? | ft\.? | x /i)[0])}|${norm(title.replace(/\s*[([].*?[)\]]/g, ""))}`;

const DIM = 1280;

/** A fingerprint sent as base64 bytes (signed 8-bit, as the browser stores them). */
export function decodeEmb(b64: unknown): number[] | null {
  if (typeof b64 !== "string" || b64.length > 2000) return null;
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== DIM) return null;
  const v = Array.from(new Int8Array(buf.buffer, buf.byteOffset, buf.length));
  return v.some((x) => x !== 0) ? v : null;
}
const asVector = (v: number[]) => `[${v.join(",")}]`;

const HOSTS = /(^|\.)(mzstatic\.com|apple\.com|sndcdn\.com|ytimg\.com|coverartarchive\.org|archive\.org|soundcloud\.com|youtube\.com|discogs\.com|musicbrainz\.org)$/;
const okUrl = (u: unknown) => {
  if (typeof u !== "string" || u.length > 600) return undefined;
  if (u.startsWith("/api/soundcloud/stream/")) return u;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && HOSTS.test(x.hostname) ? u : undefined;
  } catch {
    return undefined;
  }
};
const str = (s: unknown, max = 200) => (typeof s === "string" && s.trim() ? s.trim().slice(0, max) : undefined);

/** Only what's needed to show and play a song, checked. */
export function cleanTrack(t: Partial<Track>): Track | null {
  const id = str(t.id, 80);
  const title = str(t.title);
  const artist = str(t.artist);
  if (!id || !/^[\w:.-]+$/.test(id) || !title || !artist) return null;
  if (!["itunes", "musicbrainz", "soundcloud", "youtube"].includes(String(t.source))) return null;
  const year = Number(t.year);
  return {
    id,
    source: t.source as Track["source"],
    type: "song",
    title,
    artist,
    year: year >= 1900 && year <= 2100 ? year : undefined,
    genre: str(t.genre, 60),
    artwork: okUrl(t.artwork),
    audioUrl: okUrl(t.audioUrl),
    youtubeId: typeof t.youtubeId === "string" && /^[\w-]{11}$/.test(t.youtubeId) ? t.youtubeId : undefined,
    previewOnly: !!t.previewOnly,
    durationSec: Number(t.durationSec) > 0 ? Math.round(Number(t.durationSec)) : undefined,
    sourceBpm: Number(t.sourceBpm) > 30 ? Math.round(Number(t.sourceBpm)) : undefined,
    sourceKey: str(t.sourceKey, 6),
    tags: [],
    pageUrl: okUrl(t.pageUrl) ?? "",
    label: str(t.label, 80),
    albumId: Number(t.albumId) > 0 ? Number(t.albumId) : undefined,
    deep: !!t.deep,
  };
}

export interface SoundIn {
  track: Partial<Track>;
  emb: string;
  style?: string;
}

/** Adds songs (skipping ones already there); returns how many were new. */
export async function addSounds(items: SoundIn[]): Promise<number> {
  if (!indexEnabled()) return 0;
  const rows = items.flatMap((it) => {
    const t = cleanTrack(it.track);
    const emb = decodeEmb(it.emb);
    if (!t || !emb || !(t.audioUrl || t.youtubeId)) return [];
    return [{ id: t.id, song_key: songKey(t.artist, t.title), emb: asVector(emb), artist: t.artist, title: t.title, year: t.year ?? null, style: str(it.style, 60) ?? null, track: t }];
  });
  if (!rows.length) return 0;
  const { data, error } = await db().rpc("add_sounds", { items: rows });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** The songs nearest by sound, with a 0–1 match score. */
export async function similarSounds(emb: number[], opts: { n: number; skip?: string[]; years?: [number, number] }): Promise<(Track & { match: number })[]> {
  if (!indexEnabled()) return [];
  const { data, error } = await db().rpc("similar_sounds", {
    q: asVector(emb),
    n: opts.n,
    skip: (opts.skip ?? []).slice(0, 2000),
    min_year: opts.years?.[0] ?? null,
    max_year: opts.years?.[1] ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; track: Track; score: number }[]).map((r) => ({ ...r.track, match: Math.round(r.score * 1000) / 1000 }));
}

/** Of these songs, which are already indexed (by id or by artist + title). */
export async function knownSounds(tracks: Track[]): Promise<Set<string>> {
  if (!indexEnabled() || !tracks.length) return new Set();
  const keys = tracks.map((t) => songKey(t.artist, t.title));
  const { data } = await db().rpc("known_sounds", { ids: tracks.map((t) => t.id), keys });
  const ids = new Set(((data ?? []) as { id: string; song_key: string }[]).flatMap((r) => [r.id, r.song_key]));
  return new Set(tracks.filter((t, i) => ids.has(t.id) || ids.has(keys[i])).map((t) => t.id));
}

export async function soundCount(): Promise<number> {
  if (!indexEnabled()) return 0;
  const { count } = await db().from("sounds").select("id", { count: "estimated", head: true });
  return count ?? 0;
}
