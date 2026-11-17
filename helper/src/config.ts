import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configFile } from "./paths.ts";

export type Format = "aiff" | "wav" | "mp3";

export interface Config {
  /** Where songs are saved. */
  folder: string;
  format: Format;
  /** Sites you've allowed to send songs (asked once, in a Mac dialog). */
  allowed: string[];
  /** Sites you said no to (not asked again). */
  denied: string[];
  /** Set after the first launch (which opens the helper's status page once). */
  welcomed?: boolean;
  /** Last time yt-dlp checked for an update. */
  ytDlpChecked?: number;
}

const DEFAULTS: Config = {
  folder: process.env.CURATOR_HELPER_FOLDER ?? path.join(os.homedir(), "Music", "curator"),
  format: "mp3",
  allowed: [],
  denied: [],
};

let cache: Config | null = null;

export function config(): Config {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configFile, "utf8")) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache!;
}

export function saveConfig(patch: Partial<Config>) {
  cache = { ...config(), ...patch };
  fs.writeFileSync(configFile, JSON.stringify(cache, null, 2));
  return cache;
}
