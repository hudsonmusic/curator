/** Song details written into the file (and its name), as sent by curator. */
export interface Meta {
  title: string;
  artist: string;
  album?: string;
  year?: number;
  label?: string;
  genre?: string;
  bpm?: number;
  /** e.g. "Am" */
  key?: string;
  /** e.g. "8A" */
  camelot?: string;
  artwork?: string;
  /** Where it came from (shown as the comment). */
  source?: string;
}

const clean = (s: unknown, max = 200) =>
  typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : undefined;

export function sanitizeMeta(m: Partial<Meta>): Meta {
  const bpm = Number(m.bpm);
  const year = Number(m.year);
  return {
    title: clean(m.title) || "Untitled",
    artist: clean(m.artist) || "Unknown artist",
    album: clean(m.album),
    year: year >= 1900 && year <= 2100 ? Math.round(year) : undefined,
    label: clean(m.label),
    genre: clean(m.genre, 80),
    bpm: bpm >= 30 && bpm <= 300 ? Math.round(bpm * 10) / 10 : undefined,
    key: clean(m.key, 8),
    camelot: clean(m.camelot, 4),
    artwork: clean(m.artwork, 1000),
    source: clean(m.source, 500),
  };
}

/** "Artist - Title [98 BPM 8A]" without characters Finder or Ableton dislike. */
export function fileName(m: Meta): string {
  const tag = [m.bpm ? `${Math.round(m.bpm)} BPM` : "", m.camelot ?? ""].filter(Boolean).join(" ");
  const base = `${m.artist} - ${m.title}${tag ? ` [${tag}]` : ""}`;
  return base.replace(/[/:\\*?"<>|]/g, "-").replace(/^\.+/, "").slice(0, 180).trim();
}

/** ffmpeg -metadata arguments. Four-letter uppercase keys become ID3 frames as-is (AIFF, MP3). */
export function metadataArgs(m: Meta, id3: boolean): string[] {
  const pairs: [string, string | undefined][] = [
    ["title", m.title],
    ["artist", m.artist],
    ["album", m.album],
    ["date", m.year ? String(m.year) : undefined],
    ["genre", m.genre],
    ["comment", [m.bpm ? `${Math.round(m.bpm)} BPM` : "", m.key && m.camelot ? `${m.camelot} (${m.key})` : m.key ?? m.camelot ?? "", m.label ?? "", m.source ? `via curator · ${m.source}` : "via curator"].filter(Boolean).join(" · ")],
  ];
  if (id3) {
    pairs.push(["publisher", m.label], ["TBPM", m.bpm ? String(Math.round(m.bpm)) : undefined], ["TKEY", m.key]);
  } else {
    // WAV (RIFF INFO) has no BPM/key/label fields; they're in the comment and the file name.
    pairs.push(["copyright", m.label ? `℗ ${m.label}` : undefined]);
  }
  return pairs.flatMap(([k, v]) => (v ? ["-metadata", `${k}=${v}`] : []));
}
