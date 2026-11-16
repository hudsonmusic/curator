export type SampleType = "acapella" | "loop" | "song";
export type Source = "itunes" | "ccmixter" | "freesound" | "soundcloud";

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
  /** True when audioUrl is a short preview rather than the full track. */
  previewOnly: boolean;
  durationSec?: number;
  sourceBpm?: number;
  sourceKey?: string;
  tags: string[];
  pageUrl: string;
  downloadUrl?: string;
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
  src: "preview" | "youtube";
}

/** A crate you curate: the artists recommendations are pulled from. */
export interface CrateDef {
  id: string;
  name: string;
  artists: string[];
  years?: [number, number];
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
}
