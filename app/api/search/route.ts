import { NextResponse, type NextRequest } from "next/server";
import { search } from "@/lib/crate";
import type { SampleType } from "@/lib/types";
import { withLabels } from "@/lib/sources/itunes";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const type = (req.nextUrl.searchParams.get("type") ?? "all") as SampleType | "all";
  if (!q) return NextResponse.json({ tracks: [] });
  const r = await search(q.slice(0, 120), type);
  const labelled = await withLabels([...r.tracks, ...(r.related?.tracks ?? [])]);
  const n = r.tracks.length;
  return NextResponse.json({ tracks: labelled.slice(0, n), related: r.related && { ...r.related, tracks: labelled.slice(n) } });
}
