import { NextResponse, type NextRequest } from "next/server";
import { search } from "@/lib/crate";
import type { SampleType } from "@/lib/types";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const type = (req.nextUrl.searchParams.get("type") ?? "all") as SampleType | "all";
  if (!q) return NextResponse.json({ tracks: [] });
  return NextResponse.json(await search(q.slice(0, 120), type));
}
