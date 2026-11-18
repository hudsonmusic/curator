import STYLES from "./discogs-styles.json";
import { SCENES, norm } from "./scenes";

/**
 * Magic search: a free-text description ("dusty 70s soul with female vocals around
 * 95 BPM", "dark minimal techno acapellas") turned into a search plan. This parser is
 * free and runs on the server; with an Anthropic key, lib/magic-ai.ts reads the
 * description with Claude instead and fills in the same plan.
 */
export interface MagicPlan {
  /** What to dig up. */
  type: "song" | "acapella" | "any";
  /** Discogs styles (the 400 the style model knows), e.g. "Deep House". */
  styles: string[];
  /** Decades, e.g. 1970. */
  decades: number[];
  /** A tighter year range, e.g. "early 90s" → [1990, 1994]. */
  years?: [number, number];
  bpm?: [number, number];
  /** A key like "Am" or a Camelot code like "8A". */
  key?: string;
  /** Feel words: "dark", "uplifting", "melancholy", "chill"… */
  moods: string[];
  /** Artists named ("like Nas", "J Dilla"). */
  artists: string[];
  /** Other words worth searching for (instruments, themes): "rhodes", "horns", "summer". */
  terms: string[];
  vocal?: "female" | "male";
  /** Wants obscure records rather than the classics. */
  deep: boolean;
  /** How curator understood it, for the results header. */
  summary: string;
  /** "ai" when Claude read the description. */
  via: "parser" | "ai";
}

const STYLE_NAMES = (STYLES as string[]).map((s) => s.split("---")[1]);
const STYLE_BY_NORM = new Map(STYLE_NAMES.map((s) => [norm(s), s]));

/** Everyday words → Discogs styles. */
const ALIASES: [RegExp, string[]][] = [
  [/\b(boom ?bap|90s hip hop|golden era)\b/, ["Boom Bap"]],
  [/\b(hip ?hop|rap)\b/, ["Boom Bap", "Conscious", "Jazzy Hip-Hop"]],
  [/\bjazzy hip ?hop|jazz rap\b/, ["Jazzy Hip-Hop"]],
  [/\btrap\b/, ["Trap"]],
  [/\b(r ?& ?b|rnb|r and b)\b/, ["Rhythm & Blues", "Contemporary R&B"]],
  [/\bneo ?soul\b/, ["Neo Soul"]],
  [/\bsoul\b/, ["Soul"]],
  [/\bfunk(y)?\b/, ["Funk"]],
  [/\bdisco\b/, ["Disco"]],
  [/\bboogie\b/, ["Boogie"]],
  [/\bgospel\b/, ["Gospel"]],
  [/\bjazz\b/, ["Soul-Jazz", "Jazz-Funk"]],
  [/\bdeep house\b/, ["Deep House"]],
  [/\b(chicago house)\b/, ["House", "Deep House"]],
  [/\bhouse\b/, ["House", "Deep House"]],
  [/\btech ?house\b/, ["Tech House"]],
  [/\bminimal\b/, ["Minimal", "Minimal Techno"]],
  [/\btechno\b/, ["Techno"]],
  [/\bacid\b/, ["Acid House", "Acid"]],
  [/\b(dnb|drum ?(and|n|&) ?bass|jungle)\b/, ["Drum n Bass", "Jungle"]],
  [/\bgarage|uk garage|2 ?step\b/, ["UK Garage", "Garage House"]],
  [/\bdub(by)?\b/, ["Dub"]],
  [/\breggae|roots\b/, ["Reggae", "Roots Reggae"]],
  [/\bdancehall\b/, ["Dancehall"]],
  [/\bska\b/, ["Ska"]],
  [/\bbossa( nova)?\b/, ["Bossa Nova"]],
  [/\b(brazil(ian)?|mpb)\b/, ["MPB", "Bossa Nova", "Samba"]],
  [/\bsamba\b/, ["Samba"]],
  [/\bsalsa\b/, ["Salsa"]],
  [/\blatin\b/, ["Latin Jazz", "Salsa"]],
  [/\b(afro ?beat|afrobeat)\b/, ["Afrobeat"]],
  [/\bambient\b/, ["Ambient"]],
  [/\bdowntempo|trip ?hop\b/, ["Downtempo", "Trip Hop"]],
  [/\bbreaks?|breakbeat\b/, ["Breakbeat", "Breaks"]],
  [/\b(lo ?fi|lofi)\b/, ["Downtempo", "Jazzy Hip-Hop"]],
  [/\bpsych(edelic)?\b/, ["Psychedelic Rock"]],
  [/\bfolk\b/, ["Folk"]],
  [/\b(synth ?pop|80s pop)\b/, ["Synth-pop"]],
  [/\bnu ?disco|italo\b/, ["Nu-Disco", "Italo-Disco"]],
  [/\belectro\b/, ["Electro"]],
];

const MOODS = [
  "dark", "moody", "melancholy", "sad", "uplifting", "happy", "euphoric", "chill", "mellow", "dreamy", "dusty",
  "warm", "gritty", "raw", "smooth", "groovy", "hypnotic", "emotional", "romantic", "sexy", "spiritual", "summer",
  "late night", "energetic", "hard", "soft", "lush", "cinematic", "nostalgic", "eerie", "spacey", "jazzy", "soulful",
];

const STOP = new Set(
  "a an the and or of for with without some any that this those these i im i'm want need looking look find me give show songs song tracks track records record music stuff vibe vibes type kind like sounds sound sounding something by from in on at to into around about roughly approx approximately ish bpm tempo key vocals vocal vocalist singer singing acapella acapellas accapella acappella a cappella only please really very more less much lots loads few good great nice cool sample samples sampling chop chops flip".split(" "),
);

/** "early 90s" → [1990, 1994]; "70s" → decade 1970. */
function eras(t: string) {
  const decades = new Set<number>();
  let years: [number, number] | undefined;
  const re = /\b(early|mid|late)?[ -]?(?:(19|20)?(\d)0)'?s\b/g;
  for (const m of t.matchAll(re)) {
    const d = Number(m[3]);
    const century = m[2] ? Number(m[2]) * 100 : d >= 5 ? 1900 : 2000;
    const decade = century + d * 10;
    if (decade < 1940 || decade > 2020) continue;
    decades.add(decade);
    if (m[1] === "early") years = [decade, decade + 4];
    if (m[1] === "mid") years = [decade + 3, decade + 7];
    if (m[1] === "late") years = [decade + 5, decade + 9];
  }
  for (const m of t.matchAll(/\b(19[4-9]\d|20[0-2]\d)\b/g)) {
    const y = Number(m[1]);
    years = years ? [Math.min(years[0], y), Math.max(years[1], y)] : [y, y];
    decades.add(Math.floor(y / 10) * 10);
  }
  return { decades: [...decades].sort(), years };
}

function tempo(t: string): [number, number] | undefined {
  const range = t.match(/\b(\d{2,3})\s*(?:-|–|to)\s*(\d{2,3})\s*(?:bpm)?\b/);
  if (range && /bpm|tempo/.test(t)) {
    const a = +range[1], b = +range[2];
    if (a >= 50 && b <= 220 && a < b) return [a, b];
  }
  const one = t.match(/\b(\d{2,3})\s*bpm\b/) ?? t.match(/\b(?:bpm|tempo)\s*(?:of|at|around|~)?\s*(\d{2,3})\b/);
  if (one) {
    const v = +one[1];
    if (v >= 50 && v <= 220) return [Math.round(v * 0.96), Math.round(v * 1.04)];
  }
  if (/\b(slow|downtempo|laid ?back)\b/.test(t)) return [65, 98];
  if (/\b(mid ?tempo)\b/.test(t)) return [95, 118];
  if (/\b(up ?tempo|fast|driving|peak ?time)\b/.test(t)) return [120, 140];
  return undefined;
}

function musicalKey(raw: string): string | undefined {
  const cam = raw.match(/\b(1[0-2]|[1-9])\s?([AB])\b/);
  if (cam && /key|camelot/i.test(raw)) return `${cam[1]}${cam[2]}`;
  const k = raw.match(/\b([A-G])\s?(#|b|sharp|flat)?\s?(minor|min|m|major|maj)\b/);
  if (!k) return undefined;
  const acc = k[2] === "#" || k[2] === "sharp" ? "#" : k[2] === "b" || k[2] === "flat" ? "b" : "";
  return `${k[1]}${acc}${/^m(in(or)?)?$/.test(k[3]) ? "m" : ""}`;
}

/** Known artists named in the text, plus "like/by X" phrases. */
function artistsIn(raw: string, t: string): string[] {
  const out = new Set<string>();
  const all = SCENES.flatMap((s) => s.artists);
  for (const a of all) {
    const n = norm(a);
    if (n.length > 2 && ` ${t} `.includes(` ${n} `)) out.add(a);
  }
  for (const m of raw.matchAll(/\b(?:like|by|from|in the style of)\s+([A-Z0-9][\w.&'$-]*(?:\s+(?:[A-Z0-9&][\w.&'$-]*|the|of|da|de|la))*)/g)) {
    const name = m[1].replace(/\s+(the|of|da|de|la)$/i, "").trim();
    if (name.length > 1 && !/^(the|a|an)$/i.test(name)) out.add(name);
  }
  return [...out].slice(0, 6);
}

export function parsePlan(input: string): MagicPlan {
  const raw = input.trim().slice(0, 400);
  const t = norm(raw.replace(/&/g, " and ").replace(/'s\b/g, "s"));
  const type: MagicPlan["type"] = /\b(a ?c+ap+el+as?|acapela|vocals? only|vox only|dry vocals?)\b/i.test(raw)
    ? "acapella"
    : /\b(instrumental|no vocals|beats?)\b/i.test(raw)
      ? "song"
      : "any";

  const styles = new Set<string>();
  // Exact Discogs style names first ("Deep House", "Bossa Nova"), longest first.
  for (const s of [...STYLE_NAMES].sort((a, b) => b.length - a.length)) {
    const n = norm(s);
    if (n.length > 3 && ` ${t} `.includes(` ${n} `)) styles.add(s);
  }
  for (const [re, list] of ALIASES) if (re.test(t)) list.forEach((s) => STYLE_BY_NORM.has(norm(s)) && styles.add(STYLE_BY_NORM.get(norm(s))!));

  const { decades, years } = eras(t);
  const moods = MOODS.filter((m) => ` ${t} `.includes(` ${m} `));
  const vocal = /\b(female|woman|women|girl|diva|her)\b/.test(t) ? "female" : /\b(male|man|men|guy|his)\b/.test(t) ? "male" : undefined;
  const deep = /\b(obscure|rare|deep cuts?|unknown|forgotten|underground|lesser known|hidden gems?|private press)\b/.test(t);
  const artists = artistsIn(raw, t);

  // Leftover words: instruments and themes ("rhodes", "horns", "rain").
  const used = new Set([
    ...[...styles].flatMap((s) => norm(s).split(" ")),
    ...moods.flatMap((m) => m.split(" ")),
    ...artists.flatMap((a) => norm(a).split(" ")),
  ]);
  const terms = t
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w) && !used.has(w) && !/^\d/.test(w) && !/^(early|mid|late|female|male|woman|man|girl|guy|obscure|rare|deep|cuts?|underground|slow|fast|uptempo|minor|major|sharp|flat)$/.test(w))
    .filter((w) => !ALIASES.some(([re]) => re.test(w)) && !/^(brazilian|hiphop|hip|hop)$/.test(w))
    .slice(0, 4);

  const plan: MagicPlan = {
    type,
    styles: [...styles].slice(0, 5),
    decades,
    years,
    bpm: tempo(raw.toLowerCase()),
    key: musicalKey(raw),
    moods,
    artists,
    terms,
    vocal,
    deep,
    summary: "",
    via: "parser",
  };
  plan.summary = summarize(plan);
  return plan;
}

export function summarize(p: MagicPlan): string {
  const parts = [
    p.type === "acapella" ? "Acapellas" : p.type === "song" ? "Songs" : "",
    p.years ? (p.years[0] === p.years[1] ? String(p.years[0]) : `${p.years[0]}–${p.years[1]}`) : p.decades.map((d) => `${String(d).slice(2)}s`).join(", "),
    p.styles.slice(0, 3).join(", "),
    p.moods.slice(0, 3).join(", "),
    p.vocal ? `${p.vocal} vocals` : "",
    p.bpm ? `${p.bpm[0]}–${p.bpm[1]} BPM` : "",
    p.key ? `key ${p.key}` : "",
    p.artists.length ? `like ${p.artists.slice(0, 3).join(", ")}` : "",
    p.terms.length ? `“${p.terms.join(" ")}”` : "",
    p.deep ? "deep cuts" : "",
  ].filter(Boolean);
  return parts.join(" · ") || "Anything";
}
