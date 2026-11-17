import { NextResponse, type NextRequest } from "next/server";
import { cleanTitle, isoSeconds, score, type Candidate } from "@/lib/yt-match";

const cache = new Map<string, string | null>();
const API = "https://www.googleapis.com/youtube/v3";

/**
 * Finds a song's video. Search costs 100 of the free 10,000 daily units whatever the
 * result count, so it fetches 10 results, reads their lengths (1 unit) and scores them:
 * the title and artist must match, official uploads win, covers/live/remixes lose, and
 * a length close to the record's counts most.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const key = process.env.YOUTUBE_API_KEY;
  const artist = p.get("artist")?.trim() ?? "";
  const rawTitle = p.get("title")?.trim() ?? "";
  const legacy = p.get("q")?.trim();
  const duration = Number(p.get("dur")) || undefined;
  if (!key || (!legacy && !(artist && rawTitle))) return NextResponse.json({ videoId: null });

  const title = cleanTitle(rawTitle) || rawTitle;
  const q = legacy ?? `${artist} ${title}`;
  const ck = `${q}|${duration ?? ""}`;
  if (cache.has(ck) && !p.get("debug")) return NextResponse.json({ videoId: cache.get(ck) });

  try {
    const qs = new URLSearchParams({ part: "snippet", type: "video", maxResults: "10", q, key, videoEmbeddable: "true" });
    const res = await fetch(`${API}/search?${qs}`, { next: { revalidate: 604800 } });
    const json = (await res.json()) as { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[] };
    let cands: Candidate[] = (json.items ?? [])
      .filter((i) => i.id?.videoId)
      .map((i) => ({ id: i.id!.videoId!, title: i.snippet?.title ?? "", channel: i.snippet?.channelTitle ?? "" }));

    if (legacy || !cands.length) {
      const videoId = cands[0]?.id ?? null;
      cache.set(ck, videoId);
      return NextResponse.json({ videoId });
    }

    // Lengths for all candidates in one cheap call.
    const vs = new URLSearchParams({ part: "contentDetails", id: cands.map((c) => c.id).join(","), key });
    const vres = await fetch(`${API}/videos?${vs}`, { next: { revalidate: 604800 } }).catch(() => null);
    const vjson = (await vres?.json().catch(() => null)) as { items?: { id: string; contentDetails?: { duration?: string } }[] } | null;
    const lengths = new Map((vjson?.items ?? []).map((v) => [v.id, isoSeconds(v.contentDetails?.duration ?? "")]));
    cands = cands.map((c) => ({ ...c, duration: lengths.get(c.id) }));

    const ranked = cands
      .map((c, i) => ({ c, s: score(c, artist, title, duration) - i * 0.5 }))
      .sort((a, b) => b.s - a.s);
    if (p.get("debug") && process.env.NODE_ENV === "development") return NextResponse.json({ ranked });
    const best = ranked[0];
    // Nothing convincing: better to fall back (SoundCloud or the preview) than play the wrong song.
    const videoId = best && best.s >= 35 ? best.c.id : null;
    cache.set(ck, videoId);
    return NextResponse.json({ videoId });
  } catch {
    return NextResponse.json({ videoId: null });
  }
}
