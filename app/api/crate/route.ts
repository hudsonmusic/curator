import { NextResponse } from "next/server";
import { buildCrate } from "@/lib/crate";
import type { CrateRequest } from "@/lib/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json()) as CrateRequest;
  if (!body?.seed) return NextResponse.json({ error: "seed required" }, { status: 400 });
  const tracks = await buildCrate(body);
  return NextResponse.json({ tracks });
}
