import type { SampleType, Track } from "../types";

interface FsSound {
  id: number;
  name: string;
  username: string;
  url: string;
  tags?: string[];
  duration?: number;
  created?: string;
  previews?: Record<string, string>;
  ac_analysis?: { ac_tempo?: number; ac_key?: string; ac_scale?: string };
}

export const freesoundEnabled = () => !!process.env.FREESOUND_API_KEY;

export async function freesoundSearch(
  queryText: string,
  type: SampleType,
  opts: { scene?: string; page?: number; limit?: number } = {},
): Promise<Track[]> {
  const token = process.env.FREESOUND_API_KEY;
  if (!token) return [];
  const qs = new URLSearchParams({
    query: queryText,
    token,
    page_size: String(opts.limit ?? 15),
    page: String(opts.page ?? 1),
    fields: "id,name,username,url,tags,duration,created,previews,ac_analysis",
    filter: type === "loop" ? "duration:[2 TO 40]" : "duration:[1 TO 120]",
    sort: "rating_desc",
  });
  try {
    const res = await fetch(`https://freesound.org/apiv2/search/text/?${qs}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: FsSound[] };
    return (json.results ?? []).map((s) => {
      const key = s.ac_analysis?.ac_key
        ? s.ac_analysis.ac_key + (s.ac_analysis.ac_scale === "minor" ? "m" : "")
        : undefined;
      const bpm = s.ac_analysis?.ac_tempo;
      return {
        id: `fs:${s.id}`,
        source: "freesound" as const,
        type,
        title: s.name.replace(/\.(wav|mp3|aiff?|flac|ogg)$/i, ""),
        artist: s.username,
        year: s.created ? new Date(s.created).getUTCFullYear() : undefined,
        genre: type === "loop" ? "loop" : "vocal",
        scene: opts.scene,
        audioUrl: s.previews?.["preview-hq-mp3"],
        previewOnly: false,
        durationSec: s.duration ? Math.round(s.duration) : undefined,
        sourceBpm: bpm && bpm > 40 ? Math.round(bpm) : undefined,
        sourceKey: key,
        tags: (s.tags ?? []).slice(0, 4),
        pageUrl: s.url,
      };
    });
  } catch {
    return [];
  }
}
