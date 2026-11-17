/** Picks the YouTube video that is really the song, not a cover, live take, remix or reaction. */

export interface Candidate {
  id: string;
  title: string;
  channel: string;
  /** Seconds, when known. */
  duration?: number;
}

const BAD = [
  "live", "cover", "remix", "karaoke", "instrumental", "reaction", "reacts", "sped up", "slowed", "8d", "nightcore",
  "tutorial", "lesson", "how to", "extended", "edit", "acapella", "a cappella", "full album", "1 hour", "loop",
  "bass boosted", "mashup", "medley", "tribute", "parody", "drum cover", "guitar cover", "piano", "dj set", "mix",
  "rehearsal", "concert", "session", "demo", "snippet", "teaser", "tiktok", "shorts", "lyrics video", "fan made",
];

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&quot;/g, "")
    .replace(/[’'`"]/g, "")
    .replace(/\s*&\s*/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The title without "(Remastered 2009)", "- Single Version" and the like. */
export function cleanTitle(t: string): string {
  return t
    .replace(/\s*[([][^)\]]*(remaster|version|mono|stereo|edit|mix|feat|ft\.|single|album|deluxe|bonus)[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+.*(remaster|version|mono|stereo|edit|single).*$/i, "")
    .trim();
}

const STOP = new Set(["the", "a", "an", "and", "of", "to", "in", "on", "my", "your", "feat", "ft"]);
const words = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w));

export function score(c: Candidate, artist: string, title: string, duration?: number): number {
  const vt = norm(c.title);
  const ch = norm(c.channel);
  const want = norm(title);
  const tw = words(title);
  const aw = words(artist.split(/,|&| feat\.? | ft\.? | x /i)[0]);
  let s = 0;

  // The song's title must be there.
  const titleHits = tw.filter((w) => ` ${vt} `.includes(` ${w} `)).length;
  const titleShare = tw.length ? titleHits / tw.length : 0;
  if (titleShare < 0.6) return -100;
  s += titleShare * 30;
  if (` ${vt} `.includes(` ${want} `)) s += 10;

  // And the artist, in the video title or as the channel.
  const artistHits = aw.filter((w) => ` ${vt} `.includes(` ${w} `) || ` ${ch} `.includes(` ${w} `)).length;
  const artistShare = aw.length ? artistHits / aw.length : 1;
  if (artistShare < 0.5) s -= 30;
  else s += artistShare * 25;

  // Official uploads: "Artist - Topic" (auto-generated from the label's audio), VEVO, the artist's own channel.
  if (ch.endsWith(" topic")) s += 25;
  if (ch.includes("vevo")) s += 12;
  if (aw.length && aw.every((w) => ch.includes(w))) s += 10;
  if (/official (audio|video|music video)/.test(vt)) s += 6;

  // Something other than the record itself, unless the song's own title says so.
  for (const b of BAD) {
    if (` ${vt} `.includes(` ${b} `) && !` ${want} `.includes(` ${b} `)) s -= b === "mix" || b === "edit" ? 12 : 30;
  }

  // Length is the strongest tell when we know it.
  if (duration && c.duration) {
    const d = Math.abs(c.duration - duration);
    if (d <= 4) s += 25;
    else if (d <= 12) s += 12;
    else if (d <= 30) s -= 5;
    else s -= 35;
  }
  return s;
}

/** ISO 8601 "PT3M45S" → seconds. */
export function isoSeconds(iso: string): number | undefined {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
}
