import https from "node:https";
import type { Track } from "../types";

interface CcFile {
  download_url: string;
  file_nicname?: string;
  file_extra?: { type?: string; ccud?: string };
  file_format_info?: { "media-type"?: string; ps?: string };
}

interface CcUpload {
  upload_id: number;
  upload_name: string;
  user_name: string;
  user_real_name?: string;
  upload_date_format?: string;
  upload_extra?: { usertags?: string; bpm?: number | string };
  file_page_url: string;
  files: CcFile[];
}

const GENRES = [
  "hip_hop", "rap", "soul", "funk", "jazz", "house", "techno", "electronic", "disco",
  "reggae", "dub", "latin", "pop", "rnb", "downtempo", "trip_hop", "rock", "ambient",
];

function parseDuration(ps?: string): number | undefined {
  if (!ps) return undefined;
  const parts = ps.split(":").map(Number);
  if (parts.some(isNaN)) return undefined;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function toTrack(u: CcUpload, scene?: string): Track | null {
  const audio = u.files.filter((f) => f.file_format_info?.["media-type"] === "audio");
  if (!audio.length) return null;
  const pella =
    audio.find((f) => f.file_extra?.type === "pella") ??
    audio.find((f) => /pella|vox|vocal/i.test(f.file_nicname ?? "")) ??
    audio[0];
  const tags = (u.upload_extra?.usertags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const genre = tags.find((t) => GENRES.includes(t))?.replace(/_/g, " ");
  const year = u.upload_date_format?.match(/\b(19|20)\d{2}\b/)?.[0];
  const bpm = Number(u.upload_extra?.bpm);
  return {
    id: `cc:${u.upload_id}`,
    source: "ccmixter",
    type: "acapella",
    title: u.upload_name,
    artist: u.user_real_name || u.user_name,
    year: year ? Number(year) : undefined,
    genre: genre ?? "acapella",
    scene,
    // ccMixter refuses audio requests from other sites, so these open on ccMixter.
    previewOnly: false,
    durationSec: parseDuration(pella.file_format_info?.ps),
    sourceBpm: bpm > 40 && bpm < 220 ? bpm : undefined,
    tags: tags.filter((t) => /vocal|rap|spoken|sung|choir|soul|gospel/.test(t)).slice(0, 4),
    pageUrl: u.file_page_url,
    downloadUrl: pella.download_url,
  };
}

/**
 * ccMixter repeats the whole JSON body in an X-JSON response header, which is larger than
 * fetch() allows. node:https lets us raise the header limit for these requests.
 */
function getText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { maxHeaderSize: 4 * 1024 * 1024, timeout: 9000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`ccMixter ${res.statusCode}`));
      }
      res.setEncoding("utf8");
      let body = "";
      res.on("data", (c: string) => (body += c));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("ccMixter timeout")));
    req.on("error", reject);
  });
}

const cache = new Map<string, { at: number; data: CcUpload[] }>();

async function query(params: Record<string, string>): Promise<CcUpload[]> {
  const qs = new URLSearchParams({ f: "json", sort: "rank", ...params }).toString();
  const hit = cache.get(qs);
  if (hit && Date.now() - hit.at < 86_400_000) return hit.data;
  try {
    const data = JSON.parse(await getText(`https://ccmixter.org/api/query?${qs}`)) as CcUpload[];
    if (!Array.isArray(data)) return [];
    cache.set(qs, { at: Date.now(), data });
    return data;
  } catch {
    return [];
  }
}

export async function acapellas(opts: {
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  scene?: string;
}): Promise<Track[]> {
  const params: Record<string, string> = {
    tags: ["acappella", ...(opts.tags ?? [])].join(","),
    type: "all",
    limit: String(opts.limit ?? 20),
    offset: String(opts.offset ?? 0),
  };
  if (opts.search) params.search = opts.search;
  const data = await query(params);
  return data.map((u) => toTrack(u, opts.scene)).filter((t): t is Track => !!t);
}
