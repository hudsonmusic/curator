import { scToTrack, type ScTrack } from "@/lib/sources/soundcloud";
import { withSoundCloud } from "@/lib/sources/soundcloud-route";

export const maxDuration = 30;

export async function GET() {
  return withSoundCloud(async (sc) => {
    const likes = await sc.collect<ScTrack>("/me/likes/tracks?limit=200&linked_partitioning=true", 3);
    return { tracks: likes.filter((t) => t.title).map(scToTrack) };
  });
}
