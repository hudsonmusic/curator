import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.ts";
import { cacheDir, ffmpegPath, jsRuntime, tmpDir, ytDlpPath } from "./paths.ts";
import { fileName, metadataArgs, sanitizeMeta, type Meta } from "./tags.ts";
import { log } from "./log.ts";

export type State = "queued" | "downloading" | "converting" | "done" | "error";

export interface Job {
  id: string;
  state: State;
  /** 0–1 */
  progress: number;
  /** What it's doing right now, in words ("Finding the audio…"). */
  detail?: string;
  meta: Meta;
  /** No song details were sent (a link pasted into the helper): read them from the page. */
  auto?: boolean;
  url: string;
  /** The saved file, when done. */
  file?: string;
  error?: string;
  created: number;
}

const jobs = new Map<string, Job>();
const queue: Job[] = [];
let busy = false;

/** Only song pages and files from services curator links to. */
export function allowedSource(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host === "youtube.com" && u.pathname === "/watch" && /^[\w-]{11}$/.test(u.searchParams.get("v") ?? "")) {
    return `https://www.youtube.com/watch?v=${u.searchParams.get("v")}`;
  }
  const short = u.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})\/?$/);
  if (host === "youtube.com" && short) return `https://www.youtube.com/watch?v=${short[1]}`;
  if (u.hostname === "on.soundcloud.com" && /^\/[\w-]+\/?$/.test(u.pathname)) return `https://on.soundcloud.com${u.pathname}`;
  if (host === "youtu.be" && /^\/[\w-]{11}$/.test(u.pathname)) return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`;
  if (host === "soundcloud.com" && /^\/[\w-]+\/[\w-]+\/?$/.test(u.pathname)) return `https://soundcloud.com${u.pathname}`;
  return null;
}

const ART_HOSTS = ["mzstatic.com", "sndcdn.com", "ytimg.com", "coverartarchive.org", "archive.org", "freesound.org"];

/** The first cover that downloads, of the ones given (best first). */
async function fetchArtwork(urls: string | (string | undefined)[] | undefined, id: string): Promise<string | null> {
  for (const u of Array.isArray(urls) ? urls : [urls]) {
    const file = u ? await fetchOne(u, id) : null;
    if (file) return file;
  }
  return null;
}

async function fetchOne(url: string, id: string): Promise<string | null> {
  try {
    const u = new URL(url.replace(/\/\d+x\d+bb\./, "/1000x1000bb.").replace(/-large\./, "-t500x500."));
    if (u.protocol !== "https:" || !ART_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return null;
    const file = path.join(tmpDir, `${id}.cover`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return file;
  } catch {
    return null;
  }
}

function proc(cmd: string, args: string[], env: Record<string, string>, onLine: (line: string) => void): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const feed = (buf: Buffer, into: "out" | "err") => {
      const s = buf.toString();
      if (into === "out") out += s;
      else err += s;
      for (const line of s.split(/\r|\n/)) if (line.trim()) onLine(line);
    };
    p.stdout.on("data", (b: Buffer) => feed(b, "out"));
    p.stderr.on("data", (b: Buffer) => feed(b, "err"));
    p.on("close", (code) => resolve({ code: code ?? 1, out, err }));
    p.on("error", (e) => resolve({ code: 1, out, err: String(e) }));
  });
}

function uniquePath(dir: string, base: string, ext: string): string {
  let p = path.join(dir, `${base}.${ext}`);
  for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i}).${ext}`);
  return p;
}

/** A plain-English reason from yt-dlp's error output. */
function reason(err: string): string {
  const line = err.split("\n").reverse().find((l) => l.startsWith("ERROR:")) ?? "";
  if (/Sign in to confirm your age|age-restricted/i.test(line)) return "YouTube wants a sign-in for this one (age-restricted).";
  if (/unavailable|private video|removed/i.test(line)) return "That video isn't available.";
  if (/Sign in to confirm you.re not a bot/i.test(line)) return "YouTube is asking for a bot check. Try again later, or update yt-dlp in curator's Settings.";
  if (/HTTP Error 403/i.test(line)) return "YouTube refused the download. Updating yt-dlp (in Settings) usually fixes this.";
  return line.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, "").slice(0, 200) || "The download failed.";
}

/** What yt-dlp tells us about the song (for links pasted straight into the helper). */
interface Info {
  title?: string;
  track?: string;
  artist?: string;
  creator?: string;
  uploader?: string;
  channel?: string;
  thumbnail?: string;
  duration?: number;
  release_year?: number;
  album?: string;
}

const NOISE = /\s*[([](?:official|video|audio|lyrics?|visuali[sz]er|hd|hq|4k|remaster(?:ed)?|music video|full song|clip officiel)[^)\]]*[)\]]/gi;

/** Artist and title from a video or upload: its own tags, else "Artist - Title", else the channel. */
function metaFromInfo(info: Info, url: string): Partial<Meta> {
  const channel = (info.artist || info.creator || info.channel || info.uploader || "").replace(/\s*-\s*Topic$/i, "");
  let artist = info.artist || info.creator || "";
  let title = info.track || "";
  if (!title) {
    const raw = (info.title ?? "").replace(NOISE, "").trim();
    const parts = raw.split(/\s+[-–—|]\s+/);
    if (!artist && parts.length >= 2) {
      artist = parts[0];
      title = parts.slice(1).join(" - ");
    } else title = raw;
  }
  return {
    artist: (artist || channel).split(/,\s*/)[0],
    title,
    album: info.album,
    year: info.release_year,
    artwork: info.thumbnail,
    source: url,
  };
}

const num = (s: string | undefined) => (s && s !== "NA" ? Number(s) : NaN);

// How the bar is shared out: finding the audio (YouTube's lookup is often the longest
// part), downloading it, then converting and tagging.
const FIND = 0.45, GOT = 0.85;

async function run(job: Job) {
  const set = (p: Partial<Job>) => Object.assign(job, p);
  const cfg = config();
  set({ state: "downloading", progress: 0.02, detail: "Finding the audio…" });
  let art = job.auto ? null : fetchArtwork(job.meta.artwork, job.id);
  // yt-dlp says nothing while it looks the song up (YouTube can take a while), so ease
  // the bar forward meanwhile; real numbers take over as soon as bytes arrive.
  let finding = true;
  const creep = setInterval(() => {
    // Eases toward FIND (about 60% of the way there after 5 seconds) without reaching it.
    if (finding) set({ progress: job.progress + (FIND * 0.95 - job.progress) * 0.055 });
  }, 300);
  try {
    // 1. Download the best audio as-is.
    const rt = jsRuntime();
    const ytArgs = [
      "--no-playlist", "-f", "bestaudio/best", "--no-part", "--no-mtime", "--newline", "--progress",
      "--progress-template",
      "download:CURPROG %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.fragment_index)s %(progress.fragment_count)s",
      "--cache-dir", cacheDir, "--ffmpeg-location", ffmpegPath(),
      "-o", path.join(tmpDir, `${job.id}.%(ext)s`),
      "--print", "after_move:CURINFO %(.{title,track,artist,creator,uploader,channel,thumbnail,duration,release_year,album})j",
      "--print", "after_move:filepath",
      ...(rt ? ["--js-runtimes", rt.arg] : []),
      "--", job.url,
    ];
    let downloaded = "";
    let info: Info = {};
    const r = await proc(ytDlpPath(), ytArgs, rt?.env ?? {}, (line) => {
      if (line.startsWith("CURPROG ")) {
        const [got, total, est, frag, frags] = line.slice(8).trim().split(/\s+/).map(num);
        const size = total || est;
        let f = size > 0 && got >= 0 ? got / size : frags > 0 && frag >= 0 ? frag / frags : NaN;
        if (Number.isFinite(f)) {
          f = Math.max(0, Math.min(1, f));
          finding = false;
          // Never move backwards (estimates of the total size change as it goes).
          set({ detail: `Downloading · ${Math.round(f * 100)}%`, progress: Math.max(job.progress, FIND + f * (GOT - FIND)) });
        }
        return;
      }
      if (line.startsWith("CURINFO ")) {
        try {
          info = JSON.parse(line.slice(8));
        } catch {}
        return;
      }
      if (line.startsWith(tmpDir)) downloaded = line.trim();
    });
    finding = false;
    if (r.code !== 0 || !downloaded || !fs.existsSync(downloaded)) {
      log(`yt-dlp failed for ${job.url}: ${r.err.slice(-800)}`);
      throw new Error(reason(r.err));
    }
    if (job.auto) {
      set({ meta: sanitizeMeta(metaFromInfo(info, job.url)) });
      // YouTube's full-size thumbnail has no black bars (the default one is letterboxed);
      // mqdefault is the same picture, smaller, for videos without one.
      const vid = job.url.match(/[?&]v=([\w-]{11})/)?.[1];
      art = fetchArtwork(vid ? [`https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`] : [job.meta.artwork], job.id);
    }

    // 2. Convert and tag, following ffmpeg's own progress through the song.
    set({ state: "converting", progress: Math.max(job.progress, GOT), detail: "Converting and tagging…" });
    fs.mkdirSync(cfg.folder, { recursive: true });
    const fmt = cfg.format;
    const out = uniquePath(cfg.folder, fileName(job.meta), fmt === "aiff" ? "aif" : fmt);
    const cover = fmt === "wav" ? null : await art;
    const args = ["-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-y", "-i", downloaded];
    if (cover) args.push("-i", cover);
    args.push("-map", "0:a:0");
    if (cover) args.push("-map", "1:v:0", "-c:v", "mjpeg", "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale='min(1000,iw)':-2", "-disposition:v:0", "attached_pic", "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)");
    if (fmt === "aiff") args.push("-c:a", "pcm_s16be", "-ar", "44100", "-write_id3v2", "1", "-id3v2_version", "3");
    else if (fmt === "wav") args.push("-c:a", "pcm_s16le", "-ar", "44100");
    else args.push("-c:a", "libmp3lame", "-q:a", "0", "-id3v2_version", "3");
    args.push(...metadataArgs(job.meta, fmt !== "wav"), out);
    const duration = Number(info.duration) || 0;
    const f = await proc(ffmpegPath(), args, {}, (line) => {
      const m = line.match(/^out_time_(?:us|ms)=(\d+)/);
      if (!m || !duration) return;
      const done = Math.min(1, Number(m[1]) / 1e6 / duration);
      set({ progress: Math.max(job.progress, GOT + done * (0.99 - GOT)), detail: `Converting · ${Math.round(done * 100)}%` });
    });
    if (f.code !== 0) {
      log(`ffmpeg failed: ${f.err.slice(-800)}`);
      throw new Error("Couldn't convert the audio.");
    }
    set({ state: "done", progress: 1, file: out, detail: undefined });
  } catch (e) {
    set({ state: "error", error: e instanceof Error ? e.message : String(e), detail: undefined });
  } finally {
    clearInterval(creep);
    for (const f of fs.readdirSync(tmpDir)) if (f.startsWith(job.id)) fs.rmSync(path.join(tmpDir, f), { force: true });
  }
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) await run(queue.shift()!);
  busy = false;
}

export function addJob(url: string, meta: Partial<Meta>): Job {
  const auto = !meta.title && !meta.artist;
  const job: Job = { id: crypto.randomBytes(6).toString("hex"), state: "queued", progress: 0, meta: sanitizeMeta(auto ? { artist: url.includes("soundcloud") ? "SoundCloud" : "YouTube", title: "Looking it up…" } : meta), url, created: Date.now(), auto };
  jobs.set(job.id, job);
  // Keep the list short.
  if (jobs.size > 200) jobs.delete(jobs.keys().next().value!);
  queue.push(job);
  void pump();
  return job;
}

export const getJob = (id: string) => jobs.get(id);
export const listJobs = () => [...jobs.values()].sort((a, b) => b.created - a.created).slice(0, 50);
