import { NextResponse } from "next/server";
import { moreLike } from "@/lib/crate";
import type { Track } from "@/lib/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { track, seed } = (await req.json()) as { track: Track; seed?: string };
  if (!track?.id) return NextResponse.json({ tracks: [] });
  return NextResponse.json({ tracks: await moreLike(track, seed ?? String(Date.now())) });
}
