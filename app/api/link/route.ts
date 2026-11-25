import { NextResponse, type NextRequest } from "next/server";
import type { Track } from "@/lib/types";
import { parseVideoTitle, soundcloudUrlOf, youtubeIdOf } from "@/lib/link";
import { isoSeconds } from "@/lib/yt-match";
import { findPreview, withLabels } from "@/lib/sources/itunes";
import { scConfigured, scToTrack, type ScTrack } from "@/lib/sources/soundcloud";
import { appSession } from "@/lib/sources/sc-acapellas";

const ACAPELLA = /\b(a\s?c+ap+el+as?|acapela|vocals? only)\b/i;
const fail = (error: string) => NextResponse.json({ tracks: [], error });

/** A YouTube video's title and channel: from the API with a key, otherwise YouTube's open oEmbed. */
async function videoInfo(id: string) {
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const qs = new URLSearchParams({ part: "snippet,contentDetails", id, key });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${qs}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as {
      items?: { snippet?: { title?: string; channelTitle?: string }; contentDetails?: { duration?: string } }[];
    } | null;
    const v = json?.items?.[0];
    if (v?.snippet?.title) {
      return { title: v.snippet.title, channel: v.snippet.channelTitle ?? "", duration: isoSeconds(v.contentDetails?.duration ?? "") };
    }
  }
  const qs = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${id}`, format: "json" });
  const res = await fetch(`https://www.youtube.com/oembed?${qs}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return null;
  const j = (await res.json()) as { title?: string; author_name?: string };
  return j.title ? { title: j.title, channel: j.author_name ?? "", duration: undefined } : null;
}

async function openYouTube(id: string) {
  const info = await videoInfo(id);
  if (!info) return fail("That video is private, removed, or can't be played here.");
  const { artist, title } = parseVideoTitle(info.title, info.channel);
  const track: Track = {
    id: `yt:${id}`,
    source: "youtube",
    type: ACAPELLA.test(info.title) ? "acapella" : "song",
    title,
    artist,
    artwork: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    youtubeId: id,
    previewOnly: false,
    durationSec: info.duration,
    tags: [],
    pageUrl: `https://www.youtube.com/watch?v=${id}`,
  };
  // If Apple has the record: its cover, year and label, and a preview to read BPM and key from.
  const apple = await findPreview(artist, title).catch(() => null);
  const merged: Track = apple
    ? { ...track, artwork: apple.artwork ?? track.artwork, audioUrl: apple.audioUrl, previewOnly: true, year: apple.year, genre: apple.genre, albumId: apple.albumId }
    : track;
  return NextResponse.json({ name: title, tracks: await withLabels([merged]) });
}

async function openSoundCloud(url: string) {
  if (!scConfigured()) return fail("SoundCloud links need SoundCloud keys on this site.");
  let target = url;
  // Short share links redirect to the real page.
  if (new URL(url).hostname === "on.soundcloud.com") {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000) }).catch(() => null);
    const real = soundcloudUrlOf(res?.headers.get("location") ?? "");
    if (!real) return fail("That SoundCloud link doesn't lead to a track.");
    target = real;
  }
  const sc = await appSession();
  if (!sc) return fail("Couldn't reach SoundCloud. Try again in a moment.");
  type Resolved = ScTrack & { kind?: string; tracks?: ScTrack[] };
  const item = await sc.get<Resolved>(`/resolve?url=${encodeURIComponent(target)}`).catch(() => null);
  if (!item) return fail("That SoundCloud track is private, removed, or can't be played here.");
  const list = item.kind === "playlist" ? await sc.hydrate(item.tracks ?? []) : item.kind === "track" ? [item] : [];
  const tracks = list
    .map((t) => {
      const base = scToTrack(t);
      // "Artist - Song (Remix)" uploaded by someone else: credit the artist in the title.
      const named = base.artist === (t.user?.username ?? "") ? parseVideoTitle(t.title ?? "", base.artist) : base;
      return { ...base, artist: named.artist, title: named.title, type: ACAPELLA.test(t.title ?? "") ? ("acapella" as const) : ("song" as const) };
    })
    .filter((t) => t.audioUrl);
  if (!tracks.length) return fail("Paste a link to a SoundCloud track or playlist that can be streamed.");
  return NextResponse.json({ name: item.title ?? tracks[0].title, tracks });
}

/** Turns a pasted YouTube or SoundCloud link into playable tracks. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const id = youtubeIdOf(raw);
  if (id) return openYouTube(id);
  const sc = soundcloudUrlOf(raw);
  if (sc) return openSoundCloud(sc);
  return fail("That isn't a YouTube or SoundCloud link.");
}
