import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ScSession, TOKEN_COOKIE, parseToken } from "@/lib/sources/soundcloud";
import { tokenCookieOptions } from "@/lib/sources/soundcloud-route";

interface Streams {
  http_mp3_128_url?: string;
  hls_aac_160_url?: string;
  hls_mp3_128_url?: string;
  preview_mp3_128_url?: string;
}

/** Redirects the audio player to a playable SoundCloud stream for this track. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tok = parseToken((await cookies()).get(TOKEN_COOKIE)?.value);
  if (!tok || !/^\d+$/.test(id)) return new NextResponse(null, { status: 401 });
  const sc = new ScSession(tok);
  try {
    const s = await sc.get<Streams>(`/tracks/${id}/streams`);
    const url = s.http_mp3_128_url ?? s.preview_mp3_128_url ?? s.hls_mp3_128_url ?? s.hls_aac_160_url;
    if (!url) return new NextResponse(null, { status: 404 });
    const res = NextResponse.redirect(url, 302);
    res.headers.set("Cache-Control", "private, no-store");
    if (sc.changed) res.cookies.set(TOKEN_COOKIE, JSON.stringify(sc.tok), tokenCookieOptions);
    return res;
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
