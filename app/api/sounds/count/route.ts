import { NextResponse } from "next/server";
import { soundCount } from "@/lib/sound-index";

export async function GET() {
  return NextResponse.json({ count: await soundCount().catch(() => 0) }, { headers: { "cache-control": "public, max-age=60" } });
}
