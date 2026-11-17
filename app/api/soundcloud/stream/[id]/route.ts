import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ScSession, TOKEN_COOKIE, parseToken } from "@/lib/sources/soundcloud";
import { tokenCookieOptions } from "@/lib/sources/soundcloud-route";
import { appSession } from "@/lib/sources/sc-acapellas";

interface Streams {
  http_mp3_128_url?: string;
  hls_aac_160_url?: string;
  hls_mp3_128_url?: string;
  preview_mp3_128_url?: string;
}

/**
 * Finds a playable stream for a SoundCloud track. SoundCloud's stream links need a
 * token (yours when you've connected SoundCloud, else curator's own app token, which
 * is how acapellas play for everyone), so they're resolved here to the signed CDN
 * address the browser can load. Full tracks are HLS (the player uses hls.js); some tracks only
 * offer a 30-second preview.
 *
 * `?resolve=1` returns `{ url, hls, preview }`; without it, redirects to the stream.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const tok = parseToken((await cookies()).get(TOKEN_COOKIE)?.value);
  const sc = tok ? new ScSession(tok) : await appSession();
  if (!sc) return NextResponse.json({ error: "Not connected" }, { status: 401 });
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
    if (tok && sc.changed) res.cookies.set(TOKEN_COOKIE, JSON.stringify(sc.tok), tokenCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "SoundCloud error" }, { status: 502 });
  }
}
