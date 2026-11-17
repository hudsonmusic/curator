import { NextRequest } from "next/server";

// Cover art proxy so the page can read an image's colours when its host doesn't allow it.
// Only known artwork hosts, only images.
const HOSTS = ["mzstatic.com", "sndcdn.com", "ytimg.com", "coverartarchive.org", "archive.org", "freesound.org", "ccmixter.org"];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  let url: URL;
  try {
    url = new URL(raw ?? "");
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (url.protocol !== "https:" || !HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
    return new Response("host not allowed", { status: 403 });
  }
  const res = await fetch(url, { redirect: "follow" }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) return new Response("not found", { status: 404 });
  return new Response(res.body, {
    headers: { "content-type": type, "cache-control": "public, max-age=604800, immutable" },
  });
}
