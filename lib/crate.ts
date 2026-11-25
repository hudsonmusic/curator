import type { CrateDef, CrateRequest, SampleType, Track } from "./types";
import { SCENES, SCENE_BY_ID, norm, sceneForArtist, type Scene } from "./scenes";
import { mapLimit, pick, rngFrom, shuffle } from "./rng";
import { songsByArtist, searchSongs } from "./sources/itunes";
import { scAcapellas } from "./sources/sc-acapellas";
import { freesoundEnabled, freesoundSearch } from "./sources/freesound";
import { scFindRecord } from "./sources/sc-acapellas";
import { mbQuery } from "./sources/musicbrainz";
import { SCENE_MB_TAGS } from "./genres";
import { deepCuts } from "./related";

const SHARE: Record<SampleType, number> = { song: 0.6, acapella: 0.22, loop: 0.18 };

function weightedPick<T>(items: T[], weight: (t: T) => number, rng: () => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = rng() * total;
  for (const t of items) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1];
}

async function songsForScene(
  scene: Scene,
  count: number,
  liked: string[],
  exclude: Set<string>,
  rng: () => number,
): Promise<Track[]> {
  const likedHere = shuffle(liked, rng).slice(0, 1);
  const artists = [...new Set([...likedHere, ...shuffle(scene.artists, rng)])].slice(0, Math.ceil(count / 2) + 1);
  const lists = await mapLimit(artists, 4, (a) => songsByArtist(a, scene));
  const out: Track[] = [];
  // Round-robin across artists so one artist doesn't take the whole scene.
  const pools = lists.map((l) => shuffle(l.filter((t) => !exclude.has(t.id)), rng));
  for (let round = 0; out.length < count && round < 3; round++) {
    for (const pool of pools) {
      const t = pool[round];
      if (t && out.length < count) out.push(t);
    }
  }
  return out;
}

export function crateToScene(c: CrateDef): Scene {
  const base = SCENE_BY_ID[c.id];
  return {
    id: c.id,
    name: c.name,
    blurb: "",
    years: c.years ?? [1900, 2100],
    artists: c.artists,
    loopQueries: base?.loopQueries ?? [`${c.name} loop`],
    vocalQueries: base?.vocalQueries ?? [`${c.name} vocal`],
  };
}

/** The MusicBrainz tags for a crate: its scene's, or (for your own crates) those of the scene most of its artists belong to. */
function tagsFor(scene: Scene): string[] {
  if (SCENE_MB_TAGS[scene.id]) return SCENE_MB_TAGS[scene.id];
  const counts = new Map<string, number>();
  for (const a of scene.artists) {
    const s = sceneForArtist(a);
    if (s) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 2 ? SCENE_MB_TAGS[top[0]] ?? [] : [];
}

/**
 * Records from the crate's scene and era by artists who aren't in it: obscure
 * releases from MusicBrainz, playable through an Apple preview or a SoundCloud upload.
 */
async function deepForScene(scene: Scene, n: number, exclude: Set<string>, rng: () => number): Promise<Track[]> {
  const tags = tagsFor(scene);
  if (!tags.length || n < 1) return [];
  const [lo, hi] = scene.years[0] > 1900 ? scene.years : [1965, 2005];
  const from = lo + Math.floor(rng() * Math.max(1, hi - lo - 2));
  const q = [mbQuery.tags(tags), mbQuery.years(from, Math.min(hi, from + 3))].join(" AND ");
  const known = new Set(scene.artists.map(norm));
  const work = (async () => {
    const picks = (await deepCuts(q, n * 3, rng, { scene, previews: n * 2, exclude })).filter((t) => !known.has(norm(t.artist)));
    const playable = picks.filter((t) => t.audioUrl);
    if (playable.length < n) {
      const rest = picks.filter((t) => !t.audioUrl).slice(0, 3);
      const found = await mapLimit(rest, 3, (t) => scFindRecord(t.artist, t.title).then((sc) => (sc ? { ...t, audioUrl: sc.audioUrl, artwork: t.artwork ?? sc.artwork, pageUrl: sc.pageUrl, durationSec: sc.durationSec, previewOnly: false } : null)).catch(() => null));
      playable.push(...(found.filter(Boolean) as Track[]));
    }
    return playable.slice(0, n);
  })();
  // MusicBrainz can be slow; the crate shouldn't wait on it.
  return Promise.race([work.catch(() => []), new Promise<Track[]>((r) => setTimeout(() => r([]), 9000))]);
}

/** Acapellas from SoundCloud by a few of the scene's artists. */
async function acapellasForScene(scene: Scene, count: number, exclude: Set<string>, rng: () => number) {
  const artists = shuffle(scene.artists, rng).slice(0, Math.min(4, Math.max(2, count)));
  const lists = await mapLimit(artists, 4, (a) => scAcapellas(a, { artist: a, limit: 4 }));
  return shuffle(lists.flat().filter((t) => !exclude.has(t.id)), rng).slice(0, count);
}

async function freesoundForScene(scene: Scene, type: SampleType, count: number, exclude: Set<string>, rng: () => number) {
  const q = pick(type === "loop" ? scene.loopQueries : scene.vocalQueries, rng);
  const list = await freesoundSearch(q, type, { scene: scene.id, page: 1 + Math.floor(rng() * 3) });
  return shuffle(list.filter((t) => !exclude.has(t.id) && t.audioUrl), rng).slice(0, count);
}

export async function buildCrate(req: CrateRequest): Promise<Track[]> {
  const rng = rngFrom(req.seed);
  let scenes = req.crates?.length
    ? req.crates.filter((c) => c.artists.length).map(crateToScene)
    : ((req.scenes ?? []).map((id) => SCENE_BY_ID[id]).filter(Boolean) as Scene[]);
  if (!scenes.length) scenes = SCENES.slice(0, 3);
  const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
  const size = Math.min(40, Math.max(4, req.size ?? 24));
  const exclude = new Set(req.exclude ?? []);
  const fs = freesoundEnabled();

  let types = (req.types?.length ? req.types : (["song", "acapella"] as SampleType[])).filter(
    (t) => t !== "loop" || fs,
  );
  if (!types.length) types = ["song"];
  const shareTotal = types.reduce((s, t) => s + SHARE[t], 0);
  const counts = Object.fromEntries(types.map((t) => [t, Math.round((SHARE[t] / shareTotal) * size)])) as Partial<
    Record<SampleType, number>
  >;

  const weightOf = (s: Scene) => Math.max(0.25, 1 + (req.weights?.[s.id] ?? 0) * 0.4);
  const slotsFor = (n: number) => {
    const slots: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const s = weightedPick(scenes, weightOf, rng);
      slots[s.id] = (slots[s.id] ?? 0) + 1;
    }
    return Object.entries(slots).map(([id, n]) => ({ scene: sceneById[id], n }));
  };

  const likedByScene = (sceneId: string) =>
    (req.likedArtists ?? [])
      .filter((a) => a.scene === sceneId || sceneById[sceneId]?.artists.some((x) => norm(x) === norm(a.artist)))
      .map((a) => a.artist);

  const jobs: Promise<Track[]>[] = [];
  if (counts.song) {
    for (const { scene, n } of slotsFor(counts.song)) {
      jobs.push(songsForScene(scene, n, likedByScene(scene.id), exclude, rng));
      // About a third more, dug from the scene's records by artists outside the crate.
      jobs.push(deepForScene(scene, Math.max(1, Math.round(n * 0.4)), exclude, rng));
    }
  }
  if (counts.acapella) {
    const slots = slotsFor(counts.acapella);
    for (const { scene, n } of slots) {
      if (fs) {
        const half = Math.ceil(n / 2);
        jobs.push(acapellasForScene(scene, half, exclude, rng));
        jobs.push(freesoundForScene(scene, "acapella", n - half, exclude, rng));
      } else {
        jobs.push(acapellasForScene(scene, n, exclude, rng));
      }
    }
  }
  if (counts.loop) {
    for (const { scene, n } of slotsFor(counts.loop)) {
      jobs.push(freesoundForScene(scene, "loop", n, exclude, rng));
    }
  }

  const lists = await Promise.all(jobs);
  const seen = new Set<string>();
  const all = lists.flat().filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));

  // Spread types out so the crate doesn't come in clumps.
  const byType = types.map((t) => shuffle(all.filter((x) => x.type === t), rng));
  const mixed: Track[] = [];
  while (byType.some((l) => l.length)) {
    for (const l of byType) {
      const t = l.shift();
      if (t) mixed.push(t);
      if (l === byType[0]) {
        const extra = l.shift();
        if (extra) mixed.push(extra);
      }
    }
  }
  return mixed;
}

export async function search(q: string, type: SampleType | "all"): Promise<{ tracks: Track[]; related?: { scene: string; tracks: Track[] } }> {
  const jobs: Promise<Track[]>[] = [];
  if (type === "all" || type === "song") jobs.push(searchSongs(q, 30));
  if (type === "all" || type === "acapella") {
    jobs.push(scAcapellas(q, { limit: 12 }));
    jobs.push(freesoundSearch(`${q} vocal`, "acapella", { limit: 10 }));
  }
  if (type === "all" || type === "loop") jobs.push(freesoundSearch(`${q} loop`, "loop", { limit: 15 }));
  const tracks = (await Promise.all(jobs)).flat();

  // If they searched an artist we know, show the scene around them too.
  const scene = sceneForArtist(q);
  let related;
  if (scene && (type === "all" || type === "song")) {
    const rng = rngFrom(q + Date.now());
    const others = shuffle(scene.artists.filter((a) => norm(a) !== norm(q)), rng).slice(0, 4);
    const lists = await mapLimit(others, 4, (a) => songsByArtist(a, scene));
    related = { scene: scene.name, tracks: lists.flatMap((l) => shuffle(l, rng).slice(0, 2)) };
  }
  return { tracks, related };
}

export async function moreLike(track: Track, seed: string): Promise<Track[]> {
  const rng = rngFrom(seed + track.id);
  if (track.type === "song") {
    const scene = (track.scene && SCENE_BY_ID[track.scene]) || sceneForArtist(track.artist);
    const same = (await songsByArtist(track.artist, scene)).filter((t) => t.id !== track.id);
    const out = shuffle(same, rng).slice(0, 4);
    if (scene) {
      const others = shuffle(scene.artists.filter((a) => norm(a) !== norm(track.artist)), rng).slice(0, 3);
      const lists = await mapLimit(others, 3, (a) => songsByArtist(a, scene));
      out.push(...lists.flatMap((l) => shuffle(l, rng).slice(0, 2)));
    } else if (track.genre) {
      out.push(...shuffle(await searchSongs(track.genre, 25), rng).slice(0, 6));
    }
    return out;
  }
  if (track.type === "acapella" && track.source === "soundcloud") {
    const scene = sceneForArtist(track.artist);
    const artists = [track.artist, ...(scene ? shuffle(scene.artists.filter((a) => norm(a) !== norm(track.artist)), rng).slice(0, 2) : [])];
    const lists = await mapLimit(artists, 3, (a) => scAcapellas(a, { artist: a, limit: 4 }));
    return lists.flat().filter((t) => t.id !== track.id).slice(0, 8);
  }
  const words = track.title.split(/[\s_-]+/).filter((w) => w.length > 3).slice(0, 2).join(" ");
  const list = await freesoundSearch(words || track.type, track.type, { limit: 12 });
  return list.filter((t) => t.id !== track.id);
}

/** One random song from your crates, optionally limited to some decades. */
export async function randomPick(crates: CrateDef[], decades: number[], exclude: string[]): Promise<Track | null> {
  const rng = Math.random;
  const pool = crates.filter((c) => c.artists.length).map(crateToScene);
  if (!pool.length) return null;
  const skip = new Set(exclude);
  for (let attempt = 0; attempt < 4; attempt++) {
    const scene = weightedPick(pool, (s) => Math.sqrt(s.artists.length), rng);
    const artist = pick(scene.artists, rng);
    const songs = (await songsByArtist(artist, scene)).filter(
      (t) => !skip.has(t.id) && (!decades.length || (t.year && decades.includes(Math.floor(t.year / 10) * 10))),
    );
    if (songs.length) return pick(songs, rng);
  }
  return null;
}
