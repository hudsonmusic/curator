import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ScSession, TOKEN_COOKIE, parseToken } from "@/lib/sources/soundcloud";
import { tokenCookieOptions } from "@/lib/sources/soundcloud-route";

interface Streams {
  http_mp3_128_url?: string;
  hls_aac_160_url?: string;
  hls_mp3_128_url?: string;
  preview_mp3_128_url?: string;
}

/**
 * Finds a playable stream for a SoundCloud track. SoundCloud's stream links need the
 * signed-in user's token, so they're resolved here to the signed CDN address the
 * browser can load. Full tracks are HLS (the player uses hls.js); some tracks only
 * offer a 30-second preview.
 *
 * `?resolve=1` returns `{ url, hls, preview }`; without it, redirects to the stream.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tok = parseToken((await cookies()).get(TOKEN_COOKIE)?.value);
  if (!tok || !/^\d+$/.test(id)) return NextResponse.json({ error: "Not connected" }, { status: 401 });
  const sc = new ScSession(tok);
  try {
    const s = await sc.get<Streams>(`/tracks/${id}/streams`);
    const candidates = [
      { url: s.hls_mp3_128_url, hls: true, preview: false },
      { url: s.hls_aac_160_url, hls: true, preview: false },
      { url: s.http_mp3_128_url, hls: false, preview: false },
      { url: s.preview_mp3_128_url, hls: false, preview: true },
    ];
    let found: { url: string; hls: boolean; preview: boolean } | null = null;
    for (const c of candidates) {
      if (!c.url) continue;
      const r = await fetch(c.url, {
        headers: { Authorization: `OAuth ${sc.tok.access}` },
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      const loc = r.headers.get("location");
      if (r.status >= 300 && r.status < 400 && loc) {
        found = { ...c, url: loc };
        break;
      }
    }
    if (!found) return NextResponse.json({ error: "No stream" }, { status: 404 });
    const res = req.nextUrl.searchParams.has("resolve") ? NextResponse.json(found) : NextResponse.redirect(found.url, 302);
    res.headers.set("Cache-Control", "private, no-store");
    if (sc.changed) res.cookies.set(TOKEN_COOKIE, JSON.stringify(sc.tok), tokenCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "SoundCloud error" }, { status: 502 });
  }
}
