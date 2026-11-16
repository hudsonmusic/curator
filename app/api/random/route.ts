import { NextResponse } from "next/server";
import { randomPick } from "@/lib/crate";
import type { CrateDef } from "@/lib/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { crates, decades, exclude } = (await req.json()) as { crates: CrateDef[]; decades?: number[]; exclude?: string[] };
  return NextResponse.json({ track: await randomPick(crates ?? [], decades ?? [], exclude ?? []) });
}
