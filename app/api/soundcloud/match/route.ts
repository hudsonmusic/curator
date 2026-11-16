import type { NextRequest } from "next/server";
import { scToTrack, type ScTrack } from "@/lib/sources/soundcloud";
import { withSoundCloud } from "@/lib/sources/soundcloud-route";
import { norm } from "@/lib/scenes";

/** Finds the SoundCloud upload that best matches a song, for full-length playback. */
export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist") ?? "";
  const title = req.nextUrl.searchParams.get("title") ?? "";
  const dur = Number(req.nextUrl.searchParams.get("dur")) || 0;
  const cleanTitle = norm(title.replace(/\(.*?\)|\[.*?\]/g, "").replace(/ - .*$/, ""));
  const a = norm(artist.split(/,|&| feat\.? | and /i)[0]);
  if (!cleanTitle) return Response.json({ track: null });

  return withSoundCloud(async (sc) => {
    const q = encodeURIComponent(`${artist} ${title.replace(/\(.*?\)|\[.*?\]/g, "")}`.trim());
    const res = await sc.get<ScTrack[] | { collection: ScTrack[] }>(`/tracks?q=${q}&limit=15&access=playable`);
    const list = (Array.isArray(res) ? res : res.collection).filter((t) => t.title && t.access !== "blocked");
    let best: { t: ScTrack; score: number } | null = null;
    for (const t of list) {
      const tt = norm(t.title ?? "");
      const user = norm(t.user?.username ?? "");
      if (!tt.includes(cleanTitle) && !cleanTitle.includes(tt)) continue;
      let score = 1;
      if (a && (user.includes(a) || tt.includes(a))) score += 2;
      if (t.access === "playable") score += 1;
      if (dur && t.duration) {
        const diff = Math.abs(t.duration / 1000 - dur);
        score += diff < 8 ? 2 : diff < 30 ? 1 : diff > 120 ? -2 : 0;
      }
      if (/\b(remix|edit|cover|live|bootleg|flip|rework)\b/.test(tt) && !/\b(remix|edit|live)\b/.test(norm(title))) score -= 2;
      if (!best || score > best.score) best = { t, score };
    }
    return { track: best && best.score >= 2 ? scToTrack(best.t) : null };
  });
}
