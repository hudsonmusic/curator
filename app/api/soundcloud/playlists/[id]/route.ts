import { scToTrack, type ScTrack } from "@/lib/sources/soundcloud";
import { withSoundCloud } from "@/lib/sources/soundcloud-route";

export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ tracks: [] }, { status: 400 });
  return withSoundCloud(async (sc) => {
    const pl = await sc.get<{ tracks?: ScTrack[] }>(`/playlists/${id}?show_tracks=true`);
    const tracks = await sc.hydrate(pl.tracks ?? []);
    return { tracks: tracks.map(scToTrack) };
  });
}
