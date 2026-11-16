import { NextResponse, type NextRequest } from "next/server";

const cache = new Map<string, string | null>();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const key = process.env.YOUTUBE_API_KEY;
  if (!q || !key) return NextResponse.json({ videoId: null });
  if (cache.has(q)) return NextResponse.json({ videoId: cache.get(q) });
  const qs = new URLSearchParams({ part: "snippet", type: "video", maxResults: "1", q, key, videoEmbeddable: "true" });
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${qs}`, { next: { revalidate: 604800 } });
    const json = (await res.json()) as { items?: { id?: { videoId?: string } }[] };
    const videoId = json.items?.[0]?.id?.videoId ?? null;
    cache.set(q, videoId);
    return NextResponse.json({ videoId });
  } catch {
    return NextResponse.json({ videoId: null });
  }
}
