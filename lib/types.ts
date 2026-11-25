export type SampleType = "acapella" | "loop" | "song";
/** Who's digging: a producer after samples, or a DJ building a set. */
export type Mode = "producer" | "dj";
/** What a producer is after. */
export type DigFor = "any" | "loops" | "vocals";
/** Where a DJ set is heading next, relative to what's playing. */
export type Flow = "hold" | "build" | "cool";

export type Source = "itunes" | "deezer" | "freesound" | "soundcloud" | "musicbrainz" | "youtube";

export interface Track {
  id: string;
  source: Source;
  type: SampleType;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  scene?: string;
  artwork?: string;
  /** Audio we can play in the page. Missing when the source only allows listening on its own site. */
  audioUrl?: string;
  /** The exact YouTube video to play (a link you opened). */
  youtubeId?: string;
  /** True when audioUrl is a short preview rather than the full track. */
  previewOnly: boolean;
  durationSec?: number;
  sourceBpm?: number;
  sourceKey?: string;
  tags: string[];
  pageUrl: string;
  downloadUrl?: string;
  /** Record label, when the source knows it. */
  label?: string;
  /** iTunes album id, used to look up the label. */
  albumId?: number;
  /** How alike it sounds to the song a search started from (0–1), from the sound index. */
  match?: number;
  /** A deep cut: an obscure record found through MusicBrainz rather than a known catalog hit. */
  deep?: boolean;
}

/** What "find related" pivots on. */
export type RelatedBy = "style" | "label" | "genre" | "year" | "bpm" | "key" | "artist";

export interface RelatedQuery {
  by: RelatedBy;
  /** The label, genre, year, BPM or key clicked; for "style" the seed track's title. */
  value: string;
  /** The track it started from, for context (scene, era, BPM). */
  track?: Track;
  /** Only keep tracks in a compatible key. */
  matchKey?: boolean;
  /** Discogs styles the model heard in the seed track, strongest first. */
  styles?: string[];
}

export interface Section {
  start: number;
  end: number;
  score: number;
}

export interface Analysis {
  bpm: number;
  key: string;
  camelot: string;
  keyConfidence: number;
  peaks: number[];
  sections: Section[];
  /** 0–1: how much clean melodic, drum-light material the audio has. */
  melodic: number;
  duration: number;
}

export interface Marker {
  t: number;
  /** "full" = the full-length version (YouTube/SoundCloud). "youtube" is from older versions. */
  src: "preview" | "full" | "youtube";
}

/** A crate you curate: the artists recommendations are pulled from. */
export interface CrateDef {
  id: string;
  name: string;
  artists: string[];
  years?: [number, number];
  /** Link id when you've shared this crate. */
  shareId?: string;
  /** Link id of the shared crate this one was added from. */
  fromShare?: string;
}

export interface CrateRequest {
  crates?: CrateDef[];
  scenes?: string[];
  types: SampleType[];
  weights?: Record<string, number>;
  likedArtists?: { artist: string; scene?: string }[];
  exclude?: string[];
  seed: string;
  size?: number;
  mode?: Mode;
  digFor?: DigFor;
  /** DJ: favour long and extended versions. */
  extended?: boolean;
}
