import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Small bits of macOS: Finder and open at login. (No AppleScript: macOS shows that as Script Editor.) */

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => execFile(cmd, args, { timeout: 30000 }, (err) => resolve(err ? 1 : 0)));
}

export const reveal = (file: string) => run("open", ["-R", file]);
export const openFolder = (dir: string) => run("open", [dir]);
export const openUrl = (url: string) => run("open", [url]);

const AGENT = path.join(os.homedir(), "Library", "LaunchAgents", "app.curator.helper.plist");

export function openAtLogin(): boolean {
  return fs.existsSync(AGENT);
}

/** Starts the helper when you log in (a LaunchAgent pointing at this app). */
export function setOpenAtLogin(on: boolean, exec: string) {
  if (!on) {
    fs.rmSync(AGENT, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(AGENT), { recursive: true });
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  fs.writeFileSync(
    AGENT,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>app.curator.helper</string>
  <key>ProgramArguments</key><array><string>${esc(exec)}</string></array>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
`,
  );
}
