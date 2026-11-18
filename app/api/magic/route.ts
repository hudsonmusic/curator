import { NextResponse } from "next/server";
import { parsePlan } from "@/lib/magic";
import { aiPlan } from "@/lib/magic-ai";
import { magicSearch } from "@/lib/magic-search";

export const maxDuration = 60;

/** Magic search: a description in, a search plan and the songs/acapellas it found out. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { q?: string; exclude?: string[]; seed?: string };
  const q = body.q?.trim();
  if (!q) return NextResponse.json({ error: "Describe what you're after." }, { status: 400 });
  const plan = (await aiPlan(q)) ?? parsePlan(q);
  const result = await magicSearch(plan, body.seed ?? q, body.exclude ?? []);
  return NextResponse.json({ plan, ...result });
}
