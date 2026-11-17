import fs from "node:fs";
import { logFile } from "./paths.ts";

export function log(msg: string) {
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 2_000_000) fs.rmSync(logFile);
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
  if (process.stdout.isTTY) console.log(msg);
}
