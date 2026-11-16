import crypto from "node:crypto";
import type { Track } from "../types";

const API = "https://api.soundcloud.com";
const AUTH = "https://secure.soundcloud.com";
export const TOKEN_COOKIE = "sc_token";
export const PKCE_COOKIE = "sc_pkce";

export const scConfigured = () => !!(process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_SECRET);

export interface ScToken {
  access: string;
  refresh?: string;
  /** ms epoch */
  exp: number;
}

interface ScTrack {
  id: number;
  title?: string;
  user?: { username?: string };
  artwork_url?: string | null;
  genre?: string | null;
  release_year?: number | null;
  created_at?: string;
  bpm?: number | null;
  key_signature?: string | null;
  permalink_url?: string;
  duration?: number;
  access?: "playable" | "preview" | "blocked";
  streamable?: boolean;
}

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function newPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  return { verifier, challenge, state };
}

export function authorizeUrl(redirectUri: string, state: string, challenge: string) {
  const qs = new URLSearchParams({
    client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  return `${AUTH}/authorize?${qs}`;
}

async function tokenRequest(body: Record<string, string>): Promise<ScToken> {
  const res = await fetch(`${AUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json; charset=utf-8" },
    body: new URLSearchParams({
      client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
      client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
      ...body,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`SoundCloud token ${res.status}`);
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
}

export const exchangeCode = (code: string, redirectUri: string, verifier: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });

export const refreshToken = (tok: ScToken) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: tok.refresh ?? "" }).then((t) => ({
    ...t,
    refresh: t.refresh ?? tok.refresh,
  }));

export function parseToken(raw?: string): ScToken | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as ScToken;
    return t.access ? t : null;
  } catch {
    return null;
  }
}

/** A SoundCloud API session that refreshes its token when needed. */
export class ScSession {
  changed = false;
  constructor(public tok: ScToken) {}

  async get<T>(pathOrUrl: string): Promise<T> {
    if (this.tok.exp - Date.now() < 60_000 && this.tok.refresh) await this.renew();
    let res = await this.raw(pathOrUrl);
    if (res.status === 401 && this.tok.refresh) {
      await this.renew();
      res = await this.raw(pathOrUrl);
    }
    if (!res.ok) throw new Error(`SoundCloud ${res.status}`);
    return (await res.json()) as T;
  }

  private raw(pathOrUrl: string) {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API}${pathOrUrl}`;
    return fetch(url, {
      headers: { Authorization: `OAuth ${this.tok.access}`, Accept: "application/json; charset=utf-8" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  }

  private async renew() {
    this.tok = await refreshToken(this.tok);
    this.changed = true;
  }

  /** Follows linked_partitioning pages. */
  async collect<T>(path: string, maxPages = 4): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = path;
    for (let i = 0; next && i < maxPages; i++) {
      const page: { collection?: T[]; next_href?: string | null } = await this.get(next);
      out.push(...(page.collection ?? []));
      next = page.next_href ?? null;
    }
    return out;
  }

  /** Long playlists return some tracks as bare ids; fill those in. */
  async hydrate(tracks: ScTrack[]): Promise<ScTrack[]> {
    const missing = tracks.filter((t) => !t.title).map((t) => t.id);
    const full = new Map<number, ScTrack>();
    for (let i = 0; i < missing.length; i += 50) {
      const batch = await this.get<ScTrack[] | { collection: ScTrack[] }>(`/tracks?ids=${missing.slice(i, i + 50).join(",")}`);
      for (const t of Array.isArray(batch) ? batch : batch.collection) full.set(t.id, t);
    }
    return tracks.map((t) => full.get(t.id) ?? t).filter((t) => t.title);
  }
}

export function scToTrack(t: ScTrack): Track {
  const year = t.release_year || (t.created_at ? new Date(t.created_at).getUTCFullYear() : undefined);
  const key = t.key_signature?.trim();
  return {
    id: `sc:${t.id}`,
    source: "soundcloud",
    type: "song",
    title: t.title ?? "Untitled",
    artist: t.user?.username ?? "Unknown",
    year: year || undefined,
    genre: t.genre || undefined,
    artwork: t.artwork_url?.replace("-large.", "-t500x500.") ?? undefined,
    audioUrl: t.access === "blocked" || t.streamable === false ? undefined : `/api/soundcloud/stream/${t.id}`,
    previewOnly: t.access === "preview",
    durationSec: t.duration ? Math.round(t.duration / 1000) : undefined,
    sourceBpm: t.bpm && t.bpm > 40 ? Math.round(t.bpm) : undefined,
    sourceKey: key && /^[A-G][#b]?m?$/.test(key) ? key : undefined,
    tags: [],
    pageUrl: t.permalink_url ?? "https://soundcloud.com",
  };
}

export type { ScTrack };
