import { withSoundCloud } from "@/lib/sources/soundcloud-route";

interface ScPlaylist {
  id: number;
  title: string;
  track_count?: number;
  artwork_url?: string | null;
}

export async function GET() {
  return withSoundCloud(async (sc) => {
    const lists = await sc.collect<ScPlaylist>("/me/playlists?limit=50&show_tracks=false&linked_partitioning=true", 4);
    return { playlists: lists.map((p) => ({ id: String(p.id), title: p.title, count: p.track_count ?? 0, artwork: p.artwork_url ?? null })) };
  });
}
