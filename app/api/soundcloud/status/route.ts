import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TOKEN_COOKIE, parseToken, scConfigured } from "@/lib/sources/soundcloud";
import { withSoundCloud } from "@/lib/sources/soundcloud-route";

export async function GET() {
  if (!scConfigured()) return NextResponse.json({ configured: false, connected: false });
  if (!parseToken((await cookies()).get(TOKEN_COOKIE)?.value)) return NextResponse.json({ configured: true, connected: false });
  const res = await withSoundCloud(async (sc) => {
    const me = await sc.get<{ username?: string; avatar_url?: string }>("/me");
    return { configured: true, connected: true, user: { username: me.username, avatar: me.avatar_url } };
  });
  return res.status === 401 ? NextResponse.json({ configured: true, connected: false }) : res;
}
