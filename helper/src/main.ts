import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { PORT, VERSION } from "./version.ts";
import { config, saveConfig, type Format } from "./config.ts";
import { addJob, allowedSource, getJob, listJobs } from "./jobs.ts";
import { openAtLogin, openFolder, openUrl, reveal, setOpenAtLogin } from "./mac.ts";
import { allowPage, donePage, statusPage } from "./pages.ts";
import { binDir, packaged, ytDlpPath } from "./paths.ts";
import { log } from "./log.ts";

/**
 * Curator Helper: a small local server (127.0.0.1 only) that curator talks to.
 * It downloads a song with yt-dlp, converts it with ffmpeg and saves it, tagged,
 * in a folder you can add to Ableton's Places.
 */

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const SELF = `http://127.0.0.1:${PORT}`;
/** Allow-page tokens (so other sites can't submit the form for you). */
const tokens = new Map<string, { origin: string; expires: number }>();

function trusted(origin: string | undefined): boolean {
  if (!origin) return true; // not a web page (e.g. curl on this Mac)
  return LOCAL.test(origin) || config().allowed.includes(origin);
}

const validOrigin = (o: string) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o);

/** Folders the helper may save into: anywhere in your home folder. */
function safeFolder(raw: string): string | null {
  const home = os.homedir();
  const p = path.resolve(raw.replace(/^~(?=$|\/)/, home));
  if (p !== home && !p.startsWith(home + path.sep)) return null;
  const hidden = path.relative(home, p).split(path.sep).some((part) => part.startsWith("."));
  if (hidden || p.startsWith(path.join(home, "Library") + path.sep) && !p.includes("/Ableton/")) return null;
  return p;
}

const USER_LIBRARY = path.join(os.homedir(), "Music", "Ableton", "User Library");

let ytDlpVersion = "";
function readYtDlpVersion() {
  try {
    execFile(ytDlpPath(), ["--version"], (_e, out) => (ytDlpVersion = String(out).trim()));
  } catch {}
}

function updateYtDlp(): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    let bin: string;
    try {
      bin = ytDlpPath();
    } catch (e) {
      return resolve({ ok: false, message: String(e) });
    }
    if (!bin.startsWith(binDir)) return resolve({ ok: false, message: "yt-dlp isn't managed by the helper here." });
    execFile(bin, ["-U"], { timeout: 5 * 60 * 1000 }, (err, out, errOut) => {
      saveConfig({ ytDlpChecked: Date.now() });
      readYtDlpVersion();
      const text = `${out}${errOut}`.trim();
      log(`yt-dlp -U: ${text}`);
      resolve({ ok: !err, message: text.split("\n").pop() ?? "" });
    });
  });
}

async function rawBody(req: http.IncomingMessage): Promise<string> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error("too big");
  }
  return raw;
}

async function body(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await rawBody(req);
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const host = req.headers.host ?? "";
  // Only answer to this Mac's own address (no DNS rebinding).
  if (!new RegExp(`^(127\\.0\\.0\\.1|localhost|\\[::1\\]):${PORT}$`).test(host)) {
    res.writeHead(403).end();
    return;
  }
  const send = (code: number, data: unknown) => {
    res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(data));
  };
  const html = (code: number, body: string) => {
    res.writeHead(code, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
    });
    res.end(body);
  };
  if (origin) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-methods": "GET, POST",
      "access-control-allow-headers": "content-type",
      "access-control-allow-private-network": "true",
      "access-control-max-age": "600",
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${host}`);
  const route = `${req.method} ${url.pathname}`;
  try {
    // Anyone may see that the helper is here; everything else needs your OK.
    if (route === "GET /") return html(200, statusPage({ folder: config().folder, allowed: config().allowed }));
    if (route === "GET /status") {
      const paired = trusted(origin);
      const c = config();
      return send(200, {
        app: "curator-helper",
        version: VERSION,
        paired,
        ...(paired
          ? { folder: c.folder, format: c.format, openAtLogin: openAtLogin(), ytDlp: ytDlpVersion, packaged, userLibrary: fs.existsSync(USER_LIBRARY) }
          : {}),
      });
    }
    // Allowing a site happens on the helper's own page (opened by curator's Connect button).
    if (route === "GET /allow") {
      const o = url.searchParams.get("origin") ?? "";
      if (!validOrigin(o)) return html(400, donePage(false, o));
      if (trusted(o)) return html(200, donePage(true, o));
      const token = crypto.randomBytes(16).toString("hex");
      tokens.set(token, { origin: o, expires: Date.now() + 10 * 60 * 1000 });
      return html(200, allowPage(o, token));
    }
    if (route === "POST /allow") {
      // Only the helper's own page can submit this.
      if (origin && origin !== SELF && origin !== `http://localhost:${PORT}`) return html(403, donePage(false, ""));
      const form = new URLSearchParams(await rawBody(req));
      const t = tokens.get(form.get("token") ?? "");
      const o = form.get("origin") ?? "";
      tokens.delete(form.get("token") ?? "");
      if (!t || t.origin !== o || t.expires < Date.now()) return html(400, donePage(false, o));
      const yes = form.get("answer") === "yes";
      const c = config();
      if (yes) saveConfig({ allowed: [...new Set([...c.allowed, o])] });
      log(`${yes ? "allowed" : "declined"} ${o}`);
      return html(200, donePage(yes, o));
    }
    if (!trusted(origin)) return send(403, { error: "Not allowed. Connect from curator's Settings first." });

    if (route === "POST /download") {
      const b = await body(req);
      const src = allowedSource(String(b.url ?? ""));
      if (!src) return send(400, { error: "That link isn't one the helper downloads from." });
      return send(200, { job: addJob(src, (b.meta ?? {}) as Record<string, unknown>) });
    }
    if (req.method === "GET" && url.pathname.startsWith("/jobs/")) {
      const job = getJob(url.pathname.slice(6));
      return job ? send(200, { job }) : send(404, { error: "No such job" });
    }
    if (route === "GET /jobs") return send(200, { jobs: listJobs() });
    if (route === "POST /reveal") {
      const job = getJob(String((await body(req)).id ?? ""));
      if (!job?.file) return send(404, { error: "Not saved yet" });
      await reveal(job.file);
      return send(200, { ok: true });
    }
    if (route === "POST /open-folder") {
      await openFolder(config().folder);
      return send(200, { ok: true });
    }
    if (route === "POST /folder") {
      const b = await body(req);
      const folder = b.preset === "userLibrary" ? path.join(USER_LIBRARY, "Samples", "curator") : safeFolder(String(b.folder ?? ""));
      if (!folder) return send(400, { error: "Pick a folder inside your home folder." });
      fs.mkdirSync(folder, { recursive: true });
      saveConfig({ folder });
      return send(200, { folder });
    }
    if (route === "POST /disconnect") {
      const c = config();
      if (origin) saveConfig({ allowed: c.allowed.filter((o) => o !== origin) });
      return send(200, { ok: true });
    }
    if (route === "POST /settings") {
      const b = await body(req);
      if (b.format === "aiff" || b.format === "wav" || b.format === "mp3") saveConfig({ format: b.format as Format });
      if (typeof b.openAtLogin === "boolean") setOpenAtLogin(b.openAtLogin, process.env.CURATOR_APP_EXEC || process.execPath);
      return send(200, { format: config().format, openAtLogin: openAtLogin() });
    }
    if (route === "POST /update-ytdlp") return send(200, await updateYtDlp());
    if (route === "POST /quit") {
      send(200, { ok: true });
      setTimeout(() => process.exit(0), 100);
      return;
    }
    send(404, { error: "Not found" });
  } catch (e) {
    log(`error on ${route}: ${e}`);
    send(500, { error: "Something went wrong in the helper." });
  }
});

server.on("error", async (e: NodeJS.ErrnoException) => {
  if (e.code === "EADDRINUSE") {
    // Already running (e.g. opened twice): say so and step aside.
    // Opening it again shows its status page.
    const s = (await fetch(`${SELF}/status`).then((r) => r.json()).catch(() => null)) as { app?: string } | null;
    if (s?.app === "curator-helper") await openUrl(`${SELF}/`);
    else log(`port ${PORT} is in use by another app`);
    process.exit(0);
  }
  log(`server error: ${e}`);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  log(`Curator Helper ${VERSION} listening on 127.0.0.1:${PORT} (packaged: ${packaged})`);
  readYtDlpVersion();
  // It has no windows, so the first time it's opened it shows its status page once.
  if (packaged && !config().welcomed && process.env.XPC_SERVICE_NAME !== "app.curator.helper") {
    saveConfig({ welcomed: true });
    void openUrl(`${SELF}/`);
  }
  // yt-dlp needs frequent updates to keep up with YouTube: check once a day.
  const last = config().ytDlpChecked ?? 0;
  if (packaged && Date.now() - last > 24 * 3600 * 1000) setTimeout(() => void updateYtDlp(), 5000);
});
