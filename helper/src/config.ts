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
  folder: process.env.CURATOR_HELPER_FOLDER ?? path.join(os.homedir(), "Downloads"),
  format: "mp3",
  allowed: [],
  denied: [],
};

let cache: Config | null = null;
/** Only what you've changed is saved, so new defaults reach you. */
let stored: Partial<Config> = {};

export function config(): Config {
  if (cache) return cache;
  try {
    stored = JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch {
    stored = {};
  }
  cache = { ...DEFAULTS, ...stored };
  return cache!;
}

export function saveConfig(patch: Partial<Config>) {
  config();
  stored = { ...stored, ...patch };
  cache = { ...DEFAULTS, ...stored };
  fs.writeFileSync(configFile, JSON.stringify(stored, null, 2));
  return cache;
}
