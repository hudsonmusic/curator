import { NextResponse } from "next/server";
import { dzPreviewUrl } from "@/lib/sources/deezer";

/** Sends the player to a fresh Deezer preview (their links expire after 15 minutes). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,15}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const url = await dzPreviewUrl(id);
  if (!url) return NextResponse.json({ error: "no preview" }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=600" } });
}
