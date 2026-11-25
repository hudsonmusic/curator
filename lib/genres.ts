import { SCENE_BY_ID, sceneForArtist, type Scene } from "./scenes";
import STYLES from "./discogs-styles.json";

const STYLE_SET = new Set((STYLES as string[]).map((s) => s.split("---")[1].toLowerCase()));
/** One of the 400 Discogs styles the model knows, e.g. "Deep House". */
export const isDiscogsStyle = (s: string) => STYLE_SET.has(s.toLowerCase());

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
  reggaerock: ["reggae rock", "ska punk"],
  spiritual: ["spiritual jazz", "modal jazz", "avant-garde jazz"],
  library: ["library music", "soundtrack", "italian soundtrack"],
  boogie: ["boogie", "post-disco", "modern soul"],
  italo: ["italo-disco", "cosmic disco", "space disco"],
  ukg: ["uk garage", "2-step", "speed garage"],
  rnb: ["contemporary r&b", "new jack swing"],
  afro: ["afrobeat", "highlife", "ethio-jazz"],
  citypop: ["city pop", "jazz fusion"],
  dub: ["roots reggae", "dub", "rocksteady", "lovers rock"],
};

const GENRE_SCENE: [RegExp, string][] = [
  [/r&b|new jack/i, "rnb"],
  [/hip.?hop|rap|boom.?bap/i, "boombap"],
  [/italo|cosmic|space disco/i, "italo"],
  [/boogie|post.?disco|modern soul/i, "boogie"],
  [/disco/i, "disco"],
  [/spiritual|modal|free jazz|avant/i, "spiritual"],
  [/library|soundtrack|score/i, "library"],
  [/afro|highlife|ethio/i, "afro"],
  [/city pop|j-?pop|kayo/i, "citypop"],
  [/uk garage|2.?step|speed garage/i, "ukg"],
  [/soul|funk|jazz/i, "soul"],
  [/techno|electro\b|idm|acid/i, "techno"],
  [/tech house|minimal|french house|electro house/i, "2000s"],
  [/house|dance|garage/i, "chicago"],
  [/brazil|mpb|samba|bossa/i, "brazil"],
  [/latin|salsa|cumbia|tropical|boogaloo/i, "latin"],
  [/reggae rock|ska/i, "reggaerock"],
  [/reggae|dub|rocksteady|lovers rock/i, "dub"],
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
