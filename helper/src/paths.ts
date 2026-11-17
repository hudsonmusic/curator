import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Where things live, in the packaged app and when running from source. */

const isBun = typeof (process.versions as Record<string, string | undefined>).bun === "string";
/** Running as the packaged app (a compiled single executable inside Curator Helper.app). */
export const packaged = isBun && !process.execPath.endsWith("/bun");

// CURATOR_HELPER_HOME moves everything (used for testing).
export const support = process.env.CURATOR_HELPER_HOME ?? path.join(os.homedir(), "Library", "Application Support", "Curator Helper");
export const binDir = path.join(support, "bin");
export const tmpDir = path.join(support, "tmp");
export const cacheDir = path.join(support, "cache");
export const configFile = path.join(support, "config.json");
export const logFile = path.join(support, "helper.log");

for (const d of [support, binDir, tmpDir, cacheDir]) fs.mkdirSync(d, { recursive: true });

/** The app's bundled tools: Curator Helper.app/Contents/Resources/bin. */
function bundledBin(): string | null {
  if (packaged) return path.resolve(path.dirname(process.execPath), "..", "Resources", "bin");
  const vendor = path.resolve(import.meta.dirname, "..", "vendor");
  return fs.existsSync(vendor) ? vendor : null;
}

function which(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const p = path.join(dir, name);
    if (dir && fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * yt-dlp is copied out of the app on first run so it can update itself
 * (YouTube changes often and yt-dlp keeps up with frequent releases).
 */
export function ytDlpPath(): string {
  const own = path.join(binDir, "yt-dlp");
  const bundled = bundledBin() && path.join(bundledBin()!, "yt-dlp");
  if (!fs.existsSync(own) && bundled && fs.existsSync(bundled)) {
    fs.copyFileSync(bundled, own);
    fs.chmodSync(own, 0o755);
  }
  if (fs.existsSync(own)) return own;
  const sys = which("yt-dlp");
  if (sys) return sys;
  throw new Error("yt-dlp is missing");
}

export function ffmpegPath(): string {
  const bundled = bundledBin() && path.join(bundledBin()!, "ffmpeg");
  if (bundled && fs.existsSync(bundled)) return bundled;
  const sys = which("ffmpeg");
  if (sys) return sys;
  throw new Error("ffmpeg is missing");
}

/**
 * The JavaScript runtime yt-dlp needs for YouTube. The packaged app is a Bun
 * executable, which acts as plain `bun` when BUN_BE_BUN=1, so it doubles as the runtime.
 */
export function jsRuntime(): { arg: string; env: Record<string, string> } | null {
  if (packaged) return { arg: `bun:${process.execPath}`, env: { BUN_BE_BUN: "1" } };
  for (const [name, bin] of [["deno", which("deno")], ["bun", which("bun")], ["node", which("node")]] as const) {
    if (bin) return { arg: `${name}:${bin}`, env: {} };
  }
  return null;
}
