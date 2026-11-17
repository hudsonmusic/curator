import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Small bits of macOS: dialogs, notifications, Finder, open at login. */

function run(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10 * 60 * 1000 }, (err, stdout) => {
      resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, out: String(stdout).trim() });
    });
  });
}

/** AppleScript string literal. */
const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export async function ask(message: string, yes: string, no: string): Promise<boolean> {
  const script = `display dialog ${q(message)} with title "Curator Helper" buttons {${q(no)}, ${q(yes)}} default button ${q(yes)} cancel button ${q(no)} with icon note giving up after 120`;
  const r = await run("osascript", ["-e", script]);
  return r.code === 0 && r.out.includes(`button returned:${yes}`) && !r.out.includes("gave up:true");
}

export function notify(title: string, message: string) {
  void run("osascript", ["-e", `display notification ${q(message)} with title ${q(title)}`]);
}

export async function chooseFolder(current: string): Promise<string | null> {
  const loc = fs.existsSync(current) ? ` default location (POSIX file ${q(current)})` : "";
  const r = await run("osascript", ["-e", `POSIX path of (choose folder with prompt "Where should Curator Helper save songs?"${loc})`]);
  return r.code === 0 && r.out ? r.out.replace(/\/$/, "") : null;
}

export const reveal = (file: string) => run("open", ["-R", file]);
export const openFolder = (dir: string) => run("open", [dir]);

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

export { run };
