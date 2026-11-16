import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ScSession, TOKEN_COOKIE, parseToken, scConfigured } from "./soundcloud";

export const tokenCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

/** Runs fn with the signed-in user's SoundCloud session, saving a refreshed token if needed. */
export async function withSoundCloud(fn: (sc: ScSession) => Promise<unknown>): Promise<NextResponse> {
  if (!scConfigured()) return NextResponse.json({ error: "SoundCloud isn't set up" }, { status: 501 });
  const tok = parseToken((await cookies()).get(TOKEN_COOKIE)?.value);
  if (!tok) return NextResponse.json({ error: "Not connected" }, { status: 401 });
  const sc = new ScSession(tok);
  try {
    const res = NextResponse.json(await fn(sc));
    if (sc.changed) res.cookies.set(TOKEN_COOKIE, JSON.stringify(sc.tok), tokenCookieOptions);
    return res;
  } catch (e) {
    const msg = String(e);
    const res = NextResponse.json({ error: msg }, { status: msg.includes("401") ? 401 : 502 });
    if (msg.includes("401")) res.cookies.delete(TOKEN_COOKIE);
    return res;
  }
}
