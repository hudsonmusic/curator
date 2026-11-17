import { SCENE_BY_ID, sceneForArtist, type Scene } from "./scenes";

/** MusicBrainz tags that describe each scene's records. */
export const SCENE_MB_TAGS: Record<string, string[]> = {
  boombap: ["boom bap", "east coast hip hop", "hip hop", "jazz rap"],
  soul: ["jazz-funk", "soul", "funk", "soul jazz"],
  disco: ["disco", "boogie", "post-disco"],
  chicago: ["chicago house", "deep house", "house"],
  techno: ["detroit techno", "techno", "acid house"],
  "2000s": ["tech house", "minimal techno", "french house", "electro house"],
  brazil: ["mpb", "samba", "bossa nova", "samba-funk"],
  latin: ["salsa", "boogaloo", "latin jazz", "latin"],
  reggaerock: ["reggae rock", "ska punk", "dub", "reggae"],
};

const GENRE_SCENE: [RegExp, string][] = [
  [/hip.?hop|rap|boom.?bap/i, "boombap"],
  [/disco|boogie/i, "disco"],
  [/soul|funk|jazz|r&b/i, "soul"],
  [/techno|electro\b|idm|acid/i, "techno"],
  [/tech house|minimal|french house|electro house/i, "2000s"],
  [/house|dance|garage/i, "chicago"],
  [/brazil|mpb|samba|bossa/i, "brazil"],
  [/latin|salsa|cumbia|tropical|boogaloo/i, "latin"],
  [/reggae|ska|dub/i, "reggaerock"],
  [/electronic|electronica/i, "techno"],
];

export function sceneForGenre(genre?: string): Scene | undefined {
  if (!genre) return undefined;
  const hit = GENRE_SCENE.find(([re]) => re.test(genre));
  return hit ? SCENE_BY_ID[hit[1]] : undefined;
}

/** The best scene for a track: its own, its artist's, or its genre's. */
export function sceneOf(t: { scene?: string; artist: string; genre?: string }): Scene | undefined {
  return (t.scene && SCENE_BY_ID[t.scene]) || sceneForArtist(t.artist) || sceneForGenre(t.genre);
}

/** MusicBrainz tags for a genre name; generic genres borrow their scene's tags. */
export function mbTagsFor(genre?: string, scene?: Scene): string[] {
  const g = genre?.toLowerCase().trim();
  const generic = !g || /^(dance|electronic|pop|alternative|r&b\/soul|hip-hop\/rap|world|rock)$/.test(g);
  const fromScene = scene ? SCENE_MB_TAGS[scene.id] ?? [] : [];
  // A known scene's specific tags beat a broad genre tag ("house" also matches pop records).
  if (fromScene.length) return fromScene.slice(0, 2);
  return generic ? (g ? [g] : []) : [g.replace(/\//g, " ")];
}
