import { NextResponse } from "next/server";
import { related } from "@/lib/related";
import type { RelatedQuery } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as RelatedQuery & { exclude?: string[]; seed?: string };
  if (!body?.by || !body.value) return NextResponse.json({ error: "by and value required" }, { status: 400 });
  return NextResponse.json(await related(body, body.exclude ?? [], body.seed));
}
