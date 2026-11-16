export const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR_CAMELOT = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];

export function keyName(pc: number, minor: boolean): string {
  return NOTES[((pc % 12) + 12) % 12] + (minor ? "m" : "");
}

export function camelot(pc: number, minor: boolean): string {
  const p = ((pc % 12) + 12) % 12;
  return minor ? `${MAJOR_CAMELOT[(p + 3) % 12]}A` : `${MAJOR_CAMELOT[p]}B`;
}

const ALIASES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function parseKey(name: string): { pc: number; minor: boolean } | null {
  const m = name.trim().match(/^([A-G][#b]?)\s*(m|min|minor)?$/i);
  if (!m) return null;
  const root = m[1][0].toUpperCase() + m[1].slice(1);
  const pc = ALIASES[root];
  if (pc === undefined) return null;
  return { pc, minor: !!m[2] };
}

export function shiftKey(name: string, semitones: number): string {
  const k = parseKey(name);
  if (!k) return name;
  return keyName(k.pc + Math.round(semitones), k.minor);
}

export function camelotOf(name: string): string | null {
  const k = parseKey(name);
  return k ? camelot(k.pc, k.minor) : null;
}

/** Keys that mix harmonically: same, relative major/minor, or one step on the wheel. */
export function camelotCompatible(a: string, b: string): boolean {
  const pa = a.match(/^(\d+)([AB])$/);
  const pb = b.match(/^(\d+)([AB])$/);
  if (!pa || !pb) return false;
  const na = +pa[1], nb = +pb[1];
  if (na === nb) return true;
  if (pa[2] !== pb[2]) return false;
  const d = Math.abs(na - nb);
  return d === 1 || d === 11;
}

/** Playback rate to reach the target BPM, allowing half- and double-time. */
export function syncRate(bpm: number, target: number): number {
  const options = [bpm, bpm * 2, bpm / 2].map((b) => target / b);
  options.sort((x, y) => Math.abs(Math.log(x)) - Math.abs(Math.log(y)));
  return Math.min(2, Math.max(0.5, options[0]));
}

export function semitonesFromRate(rate: number): number {
  return 12 * Math.log2(rate);
}
