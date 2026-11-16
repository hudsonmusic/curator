import { NextResponse, type NextRequest } from "next/server";
import { PKCE_COOKIE, TOKEN_COOKIE, exchangeCode } from "@/lib/sources/soundcloud";
import { tokenCookieOptions } from "@/lib/sources/soundcloud-route";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [savedState, verifier] = (req.cookies.get(PKCE_COOKIE)?.value ?? "").split(".");
  const home = new URL("/", req.nextUrl.origin);
  if (!code || !state || state !== savedState || !verifier) {
    home.searchParams.set("sc", "error");
    return NextResponse.redirect(home);
  }
  try {
    const tok = await exchangeCode(code, `${req.nextUrl.origin}/api/soundcloud/callback`, verifier);
    home.searchParams.set("sc", "connected");
    const res = NextResponse.redirect(home);
    res.cookies.set(TOKEN_COOKIE, JSON.stringify(tok), tokenCookieOptions);
    res.cookies.delete(PKCE_COOKIE);
    return res;
  } catch {
    home.searchParams.set("sc", "error");
    return NextResponse.redirect(home);
  }
}
