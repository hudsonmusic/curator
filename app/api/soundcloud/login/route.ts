import { NextResponse, type NextRequest } from "next/server";
import { PKCE_COOKIE, authorizeUrl, newPkce, scConfigured } from "@/lib/sources/soundcloud";

export async function GET(req: NextRequest) {
  if (!scConfigured()) {
    return new NextResponse(
      "SoundCloud isn't set up yet. Add SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET (see .env.example), then restart.",
      { status: 501, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  const { verifier, challenge, state } = newPkce();
  const redirectUri = `${req.nextUrl.origin}/api/soundcloud/callback`;
  const res = NextResponse.redirect(authorizeUrl(redirectUri, state, challenge));
  res.cookies.set(PKCE_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
