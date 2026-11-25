import { NextResponse } from "next/server";
import { addSounds, type SoundIn } from "@/lib/sound-index";

/** The browser sends fingerprints of songs it has listened to; they join the shared index. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { items?: SoundIn[] } | null;
  const items = Array.isArray(body?.items) ? body!.items.slice(0, 40) : [];
  try {
    return NextResponse.json({ added: await addSounds(items) });
  } catch (e) {
    console.warn("[sounds] add failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ added: 0 }, { status: 502 });
  }
}
