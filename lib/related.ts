import type { RelatedQuery, Track } from "./types";
import { SCENES, norm, type Scene } from "./scenes";
import { mapLimit, rngFrom, shuffle } from "./rng";
import { findPreview, songsByArtist, withLabels } from "./sources/itunes";
import { mbQuery, releaseToTrack, searchReleases } from "./sources/musicbrainz";
import { isDiscogsStyle, mbTagsFor, sceneForGenre, sceneOf } from "./genres";
import { decodeEmb, similarSounds, songKey } from "./sound-index";

export interface RelatedResult {
  /** Nearest by sound in the shared sound index (when the seed has been heard). */
  similar?: Track[];
  known: Track[];
  deep: Track[];
}

/** Songs that sound like a fingerprint, from the shared index; never the seed itself. */
async function soundAlikes(emb: string, seed: Track | undefined, skip: Set<string>, n = 40): Promise<Track[]> {
  const v = decodeEmb(emb);
  if (!v) return [];
  const key = seed ? songKey(seed.artist, seed.title) : "";
  const list = await similarSounds(v, { n: n + 10, skip: [...skip] }).catch((e) => {
    console.warn("[sounds] search failed:", e instanceof Error ? e.message : e);
    return [];
  });
  return list.filter((t) => !key || songKey(t.artist, t.title) !== key).slice(0, n);
}

/**
 * Deep cuts from MusicBrainz for a query: obscure releases, newest-known first-picked
 * at random. A few get matched to an iTunes preview so BPM/key can be read; the rest
 * play through YouTube.
 */
export async function deepCuts(
  query: string,
  n: number,
  rng: () => number,
  opts: { scene?: Scene; genre?: string; previews?: number; exclude?: Set<string> } = {},
): Promise<Track[]> {
  const first = await searchReleases(query, 100, 0);
  let releases = first.releases;
  // Big result sets: look somewhere random past the first page too, for variety.
  if (first.count > 150) {
    const off = 100 + Math.floor(rng() * Math.min(first.count - 100, 900));
    releases = releases.concat((await searchReleases(query, 100, off)).releases);
  }
  const seen = new Set<string>();
  const picks: Track[] = [];
  const isAlbum = (r: (typeof releases)[number]) => r["release-group"]?.["primary-type"] === "Album";
  const ordered = shuffle(releases, rng).sort((a, b) => Number(isAlbum(a)) - Number(isAlbum(b)));
  for (const r of ordered) {
    const t = releaseToTrack(r, opts.scene?.id);
    if (!t || opts.exclude?.has(t.id)) continue;
    const k = norm(t.artist) + "|" + norm(t.title);
    if (seen.has(k) || seen.has(norm(t.artist))) continue; // one record per artist
    seen.add(k);
    seen.add(norm(t.artist));
    if (!t.genre && opts.genre) t.genre = opts.genre;
    picks.push(t);
    if (picks.length >= n) break;
  }
  // Attach iTunes previews to some (iTunes is rate-limited, so only a few per request).
  const tryN = Math.min(picks.length, opts.previews ?? 6);
  const matched = await mapLimit(picks.slice(0, tryN), 2, (t) => findPreview(t.artist, t.title));
  return picks.map((t, i) => {
    const m = matched[i];
    if (!m) return t;
    // Keep MusicBrainz's original year and label; take Apple's audio and art.
    return { ...t, audioUrl: m.audioUrl, artwork: m.artwork, durationSec: m.durationSec, genre: t.genre ?? m.genre, pageUrl: t.pageUrl };
  });
}

const yearOf = (t?: Track) => t?.year;

/** Songs related to a track, or to a label/genre/year someone clicked. */
export async function related(rq: RelatedQuery, exclude: string[] = [], seed = String(Date.now()), emb?: string): Promise<RelatedResult> {
  // Similar songs: by sound across the whole shared index first, then the usual digging.
  const alikes = emb && rq.by === "style" ? soundAlikes(emb, rq.track, new Set([...exclude, ...(rq.track ? [rq.track.id] : [])])) : Promise.resolve([]);
  const rng = rngFrom(seed + rq.by + rq.value);
  const t = rq.track;
  const skip = new Set([...exclude, ...(t ? [t.id] : [])]);
  const year = rq.by === "year" ? Number(rq.value) : yearOf(t);
  // A clicked genre stands on its own (its tag is searched even if no scene matches it).
  const scene = rq.by === "genre" ? sceneForGenre(rq.value) : t ? sceneOf(t) : undefined;
  const genre = rq.by === "genre" ? rq.value : t?.genre;

  // Known: the seed artist plus artists from the same scene, kept near the era.
  const known = async (artistCount: number, span: number): Promise<Track[]> => {
    if (!scene && !t) return [];
    const artists = [
      ...(t && rq.by !== "genre" && rq.by !== "year" ? [t.artist] : []),
      ...shuffle((scene?.artists ?? []).filter((a) => !t || norm(a) !== norm(t.artist)), rng),
    ].slice(0, artistCount);
    const lists = await mapLimit(artists, 3, (a) => songsByArtist(a, scene));
    const near = (x: Track) => !year || !x.year || Math.abs(x.year - year) <= span;
    const out: Track[] = [];
    for (const l of lists) out.push(...shuffle(l.filter((x) => !skip.has(x.id) && near(x)), rng).slice(0, 4));
    return shuffle(out, rng);
  };

  // Styles the model heard in the seed are the most precise tags we have.
  const heard = rq.by !== "genre" && rq.by !== "label" ? (rq.styles ?? []).map((x) => x.toLowerCase()).slice(0, 2) : [];
  const tags = heard.length ? heard : rq.by === "genre" && isDiscogsStyle(rq.value) ? [rq.value.toLowerCase()] : mbTagsFor(genre, scene);
  const tagQ = tags.length ? mbQuery.tags(tags) : "";
  const deepFor = async (parts: string[], n: number, vinylFirst: boolean) => {
    const base = parts.filter(Boolean).join(" AND ");
    if (!base) return [];
    let list = vinylFirst ? await deepCuts(`${base} AND ${mbQuery.vinyl}`, n, rng, { scene, genre, exclude: skip }) : [];
    if (list.length < n / 2) list = list.concat(await deepCuts(base, n - list.length, rng, { scene, genre, exclude: skip }));
    return list;
  };

  let res: RelatedResult;
  switch (rq.by) {
    case "label": {
      // Label names repeat across eras and countries, so stay near the song's year when known.
      // Apple says "Big Beat Records" where MusicBrainz says "Big Beat": try both spellings.
      const short = rq.value.replace(/\s+(records|recordings|music|records? (inc|ltd|co)\.?)$/i, "").trim();
      const names = [...new Set([rq.value, short])].filter((n) => n.length > 1);
      const tries = [
        ...(year ? names.map((n) => [mbQuery.label(n), mbQuery.years(year - 8, year + 8)]) : []),
        ...names.map((n) => [mbQuery.label(n)]),
      ];
      let deep: Track[] = [];
      for (const parts of tries) {
        if (deep.length >= 8) break;
        const more = await deepFor(parts, 24 - deep.length, false);
        deep = deep.concat(more.filter((x) => !deep.some((y) => y.id === x.id)));
      }
      res = { known: [], deep };
      break;
    }
    case "year": {
      const [k, deep] = await Promise.all([known(6, 1), deepFor([tagQ, mbQuery.years(year!, year!)], 14, true)]);
      res = { known: k.filter((x) => !x.year || Math.abs(x.year - year!) <= 1), deep };
      break;
    }
    case "genre": {
      const [k, deep] = await Promise.all([known(7, 99), deepFor([tagQ], 14, true)]);
      res = { known: k, deep };
      break;
    }
    case "artist": {
      const k = t ? await songsByArtist(t.artist, scene) : [];
      res = { known: k.filter((x) => !skip.has(x.id)), deep: await deepFor([`artist:"${(t?.artist ?? rq.value).replace(/"/g, "")}"`], 12, false) };
      break;
    }
    default: {
      // style / bpm / key: same sound and era; BPM and key are narrowed in the browser once analysed.
      const span = rq.by === "style" ? 6 : 12;
      const yearsQ = year ? mbQuery.years(year - (rq.by === "style" ? 3 : 6), year + (rq.by === "style" ? 3 : 6)) : "";
      const [k, first] = await Promise.all([known(rq.by === "style" ? 6 : 8, span), deepFor([tagQ, yearsQ], 14, true)]);
      let deep = first;
      // Thin results: widen the era before giving up on it.
      if (deep.length < 6 && year) {
        const wider = await deepFor([tagQ, mbQuery.years(year - 10, year + 10)], 14 - deep.length, false);
        deep = deep.concat(wider.filter((x) => !deep.some((y) => y.id === x.id)));
      }
      res = { known: k, deep };
    }
  }
  // Nothing to go on (e.g. an unknown genre): fall back to a random scene.
  if (!res.known.length && !res.deep.length && rq.by !== "label") {
    const s = scene ?? SCENES[Math.floor(rng() * SCENES.length)];
    res.known = (await mapLimit(shuffle(s.artists, rng).slice(0, 4), 2, (a) => songsByArtist(a, s))).flatMap((l) => l.slice(0, 3));
  }
  return { similar: await alikes, known: await withLabels(res.known), deep: res.deep };
}
