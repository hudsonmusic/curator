import { NextResponse } from "next/server";
import type { Track } from "@/lib/types";
import { SCENES } from "@/lib/scenes";
import { SCENE_MB_TAGS } from "@/lib/genres";
import { mapLimit, pick, rngFrom, shuffle } from "@/lib/rng";
import { scFindRecord } from "@/lib/sources/sc-acapellas";
import { songsByArtist } from "@/lib/sources/itunes";
import { mbQuery } from "@/lib/sources/musicbrainz";
import { deepCuts } from "@/lib/related";
import { knownSounds } from "@/lib/sound-index";

export const maxDuration = 60;

/** Extra styles to dig beyond the built-in scenes (MusicBrainz tags). */
const MORE_TAGS = [
  "jazz-funk", "soul jazz", "modal", "spiritual jazz", "rare groove", "northern soul", "deep funk", "afrobeat", "highlife",
  "boogie", "italo-disco", "cosmic disco", "balearic", "deep house", "garage house", "acid house", "detroit techno",
  "minimal techno", "dub techno", "electro", "breakbeat", "uk garage", "broken beat", "nu jazz", "downtempo", "trip hop",
  "jazzy hip hop", "boom bap", "g-funk", "turntablism", "roots reggae", "lovers rock", "dub", "rocksteady", "ska",
  "mpb", "bossa nova", "samba", "tropicalia", "salsa", "boogaloo", "latin jazz", "cumbia", "library music", "psychedelic soul",
];

/**
 * A batch of records with Apple previews that aren't in the sound index yet, for
 * "Grow the sound index" to fingerprint: obscure releases from MusicBrainz by style
 * and era, or the catalog of an artist from one of the scenes.
 */
export async function GET(req: Request) {
  const seed = new URL(req.url).searchParams.get("seed") ?? String(Date.now());
  const rng = rngFrom(seed);
  let found: Track[] = [];
  try {
    if (rng() < 0.8) {
      const sceneTags = Object.values(SCENE_MB_TAGS).flat();
      const tag = pick([...sceneTags, ...MORE_TAGS], rng);
      const from = 1960 + Math.floor(rng() * 6) * 10;
      const q = [mbQuery.tags([tag]), mbQuery.years(from, from + 9)].join(" AND ");
      // Apple has the better-known ones; SoundCloud often has the rest (uploaded by diggers).
      const picks = await deepCuts(q, 16, rng, { previews: 8 });
      const withAudio = await mapLimit(picks, 4, async (t) => {
        if (t.audioUrl) return t;
        const sc = await scFindRecord(t.artist, t.title).catch(() => null);
        return sc ? { ...t, audioUrl: sc.audioUrl, artwork: t.artwork ?? sc.artwork, pageUrl: sc.pageUrl, durationSec: sc.durationSec, previewOnly: false } : t;
      });
      found = withAudio.filter((t) => t.audioUrl);
    } else {
      const scene = pick(SCENES, rng);
      const artist = pick(scene.artists, rng);
      found = shuffle(await songsByArtist(artist, scene), rng).slice(0, 20);
    }
  } catch {
    found = [];
  }
  const known = await knownSounds(found).catch(() => new Set<string>());
  return NextResponse.json({ tracks: found.filter((t) => t.audioUrl && t.type === "song" && !known.has(t.id)).slice(0, 16) });
}
