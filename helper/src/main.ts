import http from "node:http";
import { execFile } from "node:child_process";
import { PORT, VERSION } from "./version.ts";
import { config, saveConfig, type Format } from "./config.ts";
import { addJob, allowedSource, getJob, listJobs } from "./jobs.ts";
import { ask, chooseFolder, notify, openAtLogin, openFolder, reveal, setOpenAtLogin } from "./mac.ts";
import { binDir, packaged, ytDlpPath } from "./paths.ts";
import { log } from "./log.ts";

/**
 * Curator Helper: a small local server (127.0.0.1 only) that curator talks to.
 * It downloads a song with yt-dlp, converts it with ffmpeg and saves it, tagged,
 * in a folder you can add to Ableton's Places.
 */

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const asking = new Map<string, Promise<boolean>>();

function trusted(origin: string | undefined): boolean {
  if (!origin) return true; // not a web page (e.g. curl on this Mac)
  return LOCAL.test(origin) || config().allowed.includes(origin);
}

/** Asks once, in a Mac dialog, whether a site may send songs. */
function pair(origin: string): Promise<boolean> {
  if (trusted(origin)) return Promise.resolve(true);
  let p = asking.get(origin);
  if (!p) {
    p = ask(`Let ${origin} send songs to Curator Helper?\n\nThey'll be downloaded and saved in your curator folder.`, "Allow", "Don't Allow").then((ok) => {
      const c = config();
      if (ok) saveConfig({ allowed: [...new Set([...c.allowed, origin])], denied: c.denied.filter((d) => d !== origin) });
      else saveConfig({ denied: [...new Set([...c.denied, origin])] });
      asking.delete(origin);
      return ok;
    });
    asking.set(origin, p);
  }
  return p;
}

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

async function body(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error("too big");
  }
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
    if (route === "GET /status") {
      const paired = trusted(origin);
      const c = config();
      return send(200, {
        app: "curator-helper",
        version: VERSION,
        paired,
        ...(paired ? { folder: c.folder, format: c.format, openAtLogin: openAtLogin(), ytDlp: ytDlpVersion, packaged } : {}),
      });
    }
    if (route === "POST /pair") return send(200, { paired: origin ? await pair(origin) : true });
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
    if (route === "POST /choose-folder") {
      const folder = await chooseFolder(config().folder);
      if (folder) saveConfig({ folder });
      return send(200, { folder: config().folder, changed: !!folder });
    }
    if (route === "POST /settings") {
      const b = await body(req);
      if (b.format === "aiff" || b.format === "wav" || b.format === "mp3") saveConfig({ format: b.format as Format });
      if (typeof b.openAtLogin === "boolean") setOpenAtLogin(b.openAtLogin, process.execPath);
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
    const s = await fetch(`http://127.0.0.1:${PORT}/status`).then((r) => r.json()).catch(() => null) as { app?: string } | null;
    notify("Curator Helper", s?.app === "curator-helper" ? "Already running. Use it from curator." : `Port ${PORT} is in use by another app.`);
    process.exit(0);
  }
  log(`server error: ${e}`);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  log(`Curator Helper ${VERSION} listening on 127.0.0.1:${PORT} (packaged: ${packaged})`);
  readYtDlpVersion();
  if (packaged && !process.env.XPC_SERVICE_NAME?.includes("app.curator.helper")) {
    notify("Curator Helper is running", "Turn on “Save for Ableton” in curator's Settings to connect.");
  }
  // yt-dlp needs frequent updates to keep up with YouTube: check once a day.
  const last = config().ytDlpChecked ?? 0;
  if (packaged && Date.now() - last > 24 * 3600 * 1000) setTimeout(() => void updateYtDlp(), 5000);
});
