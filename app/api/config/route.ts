import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    youtube: !!process.env.YOUTUBE_API_KEY,
    freesound: !!process.env.FREESOUND_API_KEY,
  });
}
