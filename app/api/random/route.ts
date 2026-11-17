import { NextResponse } from "next/server";
import { randomPick } from "@/lib/crate";
import type { CrateDef } from "@/lib/types";
import { withLabels } from "@/lib/sources/itunes";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { crates, decades, exclude } = (await req.json()) as { crates: CrateDef[]; decades?: number[]; exclude?: string[] };
  const track = await randomPick(crates ?? [], decades ?? [], exclude ?? []);
  return NextResponse.json({ track: track ? (await withLabels([track]))[0] : null });
}
