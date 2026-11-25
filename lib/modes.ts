import type { DigFor, Flow, Mode, SampleType, Track } from "./types";

const BITS = /\b(interlude|skit|intro|outro|reprise|prelude|segue|snippet|commentary)\b/i;
const CLUB = /\b(extended|12["”″']|12 ?inch|club (mix|version)|dub (mix|version)|disco (mix|version)|long version|full length|original mix|vocal mix|instrumental mix|dance mix)\b/i;
const SHORT_EDIT = /\b(radio edit|single edit|7["”″'] (edit|version)|short version)\b/i;
const LIVE = /\b(live|demo|rehearsal|take \d)\b/i;
const REWORK = /\b(remix|rmx|re-?edit|radio edit|single edit)\b/i;
const INSTRUMENTAL = /\binstrumental\b/i;
const VOCAL = /\b(a ?cappella|acapella|vocal)\b/i;
const LOOPY = /\b(break|breaks|theme|dub|jam|groove|vamp)\b/i;

/** How well a song works on a dancefloor: long and extended versions up, interludes and radio edits down. */
export function djScore(t: Track): number {
  if (t.type !== "song") return -10;
  let s = 0;
  if (CLUB.test(t.title)) s += 2;
  const d = t.durationSec;
  if (d) s += d >= 360 ? 1.5 : d >= 270 ? 0.8 : d < 150 ? -2.5 : 0;
  if (BITS.test(t.title)) s -= 3;
  if (LIVE.test(t.title)) s -= 1.5;
  if (SHORT_EDIT.test(t.title)) s -= 0.6;
  return s;
}

/** How useful a record is to sample from, for what you're digging for. */
export function producerScore(t: Track, digFor: DigFor): number {
  let s = 0;
  // Originals over reworks and live takes.
  if (REWORK.test(t.title)) s -= 1.5;
  if (LIVE.test(t.title)) s -= 1;
  if (digFor === "loops") {
    if (t.type === "acapella") s -= 3;
    if (INSTRUMENTAL.test(t.title)) s += 1.5;
    if (LOOPY.test(t.title)) s += 0.8;
  } else if (digFor === "vocals") {
    if (t.type === "loop") s -= 3;
    if (t.type === "acapella") s += 2;
    if (INSTRUMENTAL.test(t.title)) s -= 2.5;
    if (VOCAL.test(t.title)) s += 1;
  }
  return s;
}

export function scoreFor(mode: Mode | undefined, digFor: DigFor | undefined): (t: Track) => number {
  return mode === "dj" ? djScore : (t) => producerScore(t, digFor ?? "any");
}

/** What a crate is made of in each mode (shares of the list). */
export function sharesFor(mode: Mode | undefined, digFor: DigFor | undefined): Partial<Record<SampleType, number>> {
  if (mode === "dj") return { song: 1 };
  if (digFor === "loops") return { song: 0.62, loop: 0.38 };
  if (digFor === "vocals") return { acapella: 0.55, song: 0.45 };
  return { song: 0.6, acapella: 0.22, loop: 0.18 };
}

/** The types a crate asks for in each mode. */
export function typesFor(mode: Mode, digFor: DigFor): SampleType[] {
  return Object.keys(sharesFor(mode, digFor)) as SampleType[];
}

/** The tempo a DJ set is heading for, from the song that's playing. */
export function flowTarget(bpm: number, flow: Flow) {
  return flow === "build" ? bpm * 1.04 : flow === "cool" ? bpm * 0.96 : bpm;
}

/** Closest BPM distance as a fraction, allowing half and double time. */
export function tempoGap(a: number, b: number) {
  return Math.min(...[b, b * 2, b / 2].map((x) => Math.abs(x - a) / a));
}

export const TEMPO_PRESETS: { label: string; bpm: [number, number] }[] = [
  { label: "Hip hop · 85–98", bpm: [85, 98] },
  { label: "Downtempo · 98–110", bpm: [98, 110] },
  { label: "Disco · 110–122", bpm: [110, 122] },
  { label: "House · 118–126", bpm: [118, 126] },
  { label: "Tech / techno · 124–134", bpm: [124, 134] },
  { label: "Garage / DnB · 130–175", bpm: [130, 175] },
];
