import type { Track } from "./types";
import type { MagicPlan } from "./magic";
import { SCENES, norm, type Scene } from "./scenes";
import { mapLimit, rngFrom, shuffle } from "./rng";
import { searchSongs, songsByArtist, withLabels } from "./sources/itunes";
import { mbQuery } from "./sources/musicbrainz";
import { deepCuts } from "./related";
import { sceneForGenre, SCENE_MB_TAGS } from "./genres";
import { scAcapellas } from "./sources/sc-acapellas";

export interface MagicResult {
  known: Track[];
  deep: Track[];
  acapellas: Track[];
}

/** The year range a plan asks for, if any. */
export function yearRange(p: MagicPlan): [number, number] | undefined {
  if (p.years) return p.years;
  if (!p.decades.length) return undefined;
  return [Math.min(...p.decades), Math.max(...p.decades) + 9];
}

const inYears = (t: Track, r?: [number, number]) => !r || (t.year !== undefined && t.year >= r[0] - 1 && t.year <= r[1] + 1);

/** Scenes whose sound matches the plan's styles (or whose artists it names). */
function scenesFor(p: MagicPlan): Scene[] {
  const out = new Map<string, Scene>();
  for (const s of p.styles) {
    const scene = sceneForGenre(s);
    if (scene) out.set(scene.id, scene);
  }
  for (const a of p.artists) {
    const scene = SCENES.find((s) => s.artists.some((x) => norm(x) === norm(a)));
    if (scene) out.set(scene.id, scene);
  }
  return [...out.values()];
}

/**
 * Digs for a magic-search plan: known records (named artists, artists from matching
 * scenes, title words), deep cuts from MusicBrainz by style tag and era, and
 * SoundCloud acapellas. BPM, key and the heard style are matched in the browser.
 */
export async function magicSearch(p: MagicPlan, seed: string, exclude: string[] = []): Promise<MagicResult> {
  const rng = rngFrom(seed);
  const skip = new Set(exclude);
  const years = yearRange(p);
  const wantSongs = p.type !== "acapella";
  const wantVox = p.type !== "song";
  const scenes = scenesFor(p);

  // Known records.
  const knownJob = (async () => {
    if (!wantSongs) return [];
    const named = shuffle(p.artists, rng).slice(0, 6);
    const fromScenes = shuffle(
      scenes.flatMap((s) => s.artists).filter((a) => !named.some((n) => norm(n) === norm(a))),
      rng,
    ).slice(0, Math.max(3, 8 - named.length));
    const lists = await mapLimit([...named, ...fromScenes], 4, async (a) => {
      const songs = (await songsByArtist(a).catch(() => [] as Track[])).filter((t) => t.type === "song" && inYears(t, years));
      return shuffle(songs, rng).slice(0, named.includes(a) ? 4 : 2);
    });
    // Title words ("rhodes", "summer") with the main style.
    const words = p.terms.length ? await searchSongs([...p.terms, p.styles[0] ?? ""].join(" ").trim(), 25).catch(() => []) : [];
    const byWords = shuffle(words.filter((t) => inYears(t, years)), rng).slice(0, 8);
    const seen = new Set<string>();
    const all = [...lists.flat(), ...byWords].filter((t) => {
      const k = norm(`${t.artist} ${t.title}`);
      if (skip.has(t.id) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return withLabels(shuffle(all, rng).slice(0, 40));
  })();

  // Deep cuts by style tag and era.
  const deepJob = (async () => {
    if (!wantSongs) return [];
    const tags = [...new Set([...p.styles.map((s) => s.toLowerCase()), ...scenes.flatMap((s) => SCENE_MB_TAGS[s.id] ?? []).slice(0, 2)])].slice(0, 4);
    if (!tags.length) return [];
    const parts = [mbQuery.tags(tags)];
    if (years) parts.push(mbQuery.years(years[0], years[1]));
    return deepCuts(parts.join(" AND "), p.deep ? 16 : 10, rng, { previews: 6, exclude: skip, scene: scenes[0] }).catch((e) => {
      console.warn("[magic] deep cuts failed:", e);
      return [];
    });
  })();

  // Acapellas from SoundCloud: by the named artists and artists from matching scenes
  // (searching SoundCloud by style or mood alone mostly finds unrelated uploads).
  const voxJob = (async () => {
    if (!wantVox) return [];
    const named = shuffle(p.artists, rng).slice(0, 6);
    const fromScenes = shuffle(
      scenes.flatMap((s) => s.artists).filter((a) => !named.some((n) => norm(n) === norm(a))),
      rng,
    ).slice(0, Math.max(4, 10 - named.length));
    const artists = [...named, ...fromScenes];
    // By genre too: uploads whose SoundCloud genre belongs to one of the plan's scenes
    // (a "Hip-hop & Rap" acapella for boom bap), which brings in far more than artists alone.
    const sceneIds = new Set(scenes.map((s) => s.id));
    const genreQueries = [...new Set([...scenes.flatMap((s) => (SCENE_MB_TAGS[s.id] ?? []).slice(0, 2)), ...p.styles.slice(0, 2).map((s) => s.toLowerCase())])]
      .slice(0, p.type === "acapella" ? 4 : 2)
      .map((g) => [p.vocal ?? "", ...p.terms.slice(0, 1), g].join(" ").trim());
    const [byArtist, byGenre] = await Promise.all([
      mapLimit(artists, 4, (a) => scAcapellas(a, { artist: a, limit: named.includes(a) ? 4 : 3 })),
      mapLimit(genreQueries, 3, async (q) =>
        (await scAcapellas(q, { loose: true, limit: 20 })).filter((t) => {
          const scene = sceneForGenre(t.genre);
          return scene ? sceneIds.has(scene.id) : false;
        }),
      ),
    ]);
    const seen = new Set<string>();
    return [...byArtist.flat(), ...shuffle(byGenre.flat(), rng)].filter((t) => {
      const k = norm(`${t.artist} ${t.title}`);
      if (skip.has(t.id) || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 30);
  })();

  const [known, deep, acapellas] = await Promise.all([knownJob, deepJob, voxJob]);
  return { known, deep, acapellas };
}
