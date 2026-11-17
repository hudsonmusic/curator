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
  meta: Meta;
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
  if (host === "youtu.be" && /^\/[\w-]{11}$/.test(u.pathname)) return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`;
  if (host === "soundcloud.com" && /^\/[\w-]+\/[\w-]+\/?$/.test(u.pathname)) return `https://soundcloud.com${u.pathname}`;
  return null;
}

const ART_HOSTS = ["mzstatic.com", "sndcdn.com", "ytimg.com", "coverartarchive.org", "archive.org", "freesound.org"];

async function fetchArtwork(url: string | undefined, id: string): Promise<string | null> {
  if (!url) return null;
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

async function run(job: Job) {
  const set = (p: Partial<Job>) => Object.assign(job, p);
  const cfg = config();
  set({ state: "downloading", progress: 0.02 });
  const art = fetchArtwork(job.meta.artwork, job.id);
  try {
    // 1. Download the best audio as-is.
    const rt = jsRuntime();
    const ytArgs = [
      "--no-playlist", "-f", "bestaudio/best", "--no-part", "--no-mtime", "--newline", "--progress",
      "--cache-dir", cacheDir, "--ffmpeg-location", ffmpegPath(),
      "-o", path.join(tmpDir, `${job.id}.%(ext)s`), "--print", "after_move:filepath",
      ...(rt ? ["--js-runtimes", rt.arg] : []),
      "--", job.url,
    ];
    let downloaded = "";
    const r = await proc(ytDlpPath(), ytArgs, rt?.env ?? {}, (line) => {
      const m = line.match(/\[download\]\s+([\d.]+)%/);
      if (m) set({ progress: 0.02 + (Number(m[1]) / 100) * 0.83 });
      if (line.startsWith(tmpDir)) downloaded = line.trim();
    });
    if (r.code !== 0 || !downloaded || !fs.existsSync(downloaded)) {
      log(`yt-dlp failed for ${job.url}: ${r.err.slice(-800)}`);
      throw new Error(reason(r.err));
    }

    // 2. Convert and tag.
    set({ state: "converting", progress: 0.88 });
    fs.mkdirSync(cfg.folder, { recursive: true });
    const fmt = cfg.format;
    const out = uniquePath(cfg.folder, fileName(job.meta), fmt === "aiff" ? "aif" : fmt);
    const cover = fmt === "wav" ? null : await art;
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", downloaded];
    if (cover) args.push("-i", cover);
    args.push("-map", "0:a:0");
    if (cover) args.push("-map", "1:v:0", "-c:v", "mjpeg", "-vf", "scale='min(1000,iw)':-2", "-disposition:v:0", "attached_pic", "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)");
    if (fmt === "aiff") args.push("-c:a", "pcm_s16be", "-ar", "44100", "-write_id3v2", "1", "-id3v2_version", "3");
    else if (fmt === "wav") args.push("-c:a", "pcm_s16le", "-ar", "44100");
    else args.push("-c:a", "libmp3lame", "-q:a", "0", "-id3v2_version", "3");
    args.push(...metadataArgs(job.meta, fmt !== "wav"), out);
    const f = await proc(ffmpegPath(), args, {}, () => {});
    if (f.code !== 0) {
      log(`ffmpeg failed: ${f.err.slice(-800)}`);
      throw new Error("Couldn't convert the audio.");
    }
    set({ state: "done", progress: 1, file: out });
  } catch (e) {
    set({ state: "error", error: e instanceof Error ? e.message : String(e) });
  } finally {
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
  const job: Job = { id: crypto.randomBytes(6).toString("hex"), state: "queued", progress: 0, meta: sanitizeMeta(meta), url, created: Date.now() };
  jobs.set(job.id, job);
  // Keep the list short.
  if (jobs.size > 200) jobs.delete(jobs.keys().next().value!);
  queue.push(job);
  void pump();
  return job;
}

export const getJob = (id: string) => jobs.get(id);
export const listJobs = () => [...jobs.values()].sort((a, b) => b.created - a.created).slice(0, 50);
