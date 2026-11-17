import { VERSION } from "./version.ts";

/** The helper's own small web pages (it has no windows): status, and allowing a site. */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #141416; color: #f2f2f5;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; }
  main { width: min(420px, calc(100vw - 32px)); padding: 28px; border-radius: 18px; background: rgb(32 32 36 / .8);
    border: 1px solid rgb(255 255 255 / .08); box-shadow: 0 30px 80px rgb(0 0 0 / .5); }
  .disc { width: 44px; height: 44px; border-radius: 50%; background: radial-gradient(circle, #141416 0 9%, #0a84ff 10% 38%, #050506 39%);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / .08); margin-bottom: 16px; }
  h1 { font-size: 18px; margin: 0 0 6px; letter-spacing: -.01em; }
  p { margin: 0 0 12px; color: #98989f; }
  code, .origin { font: 13px ui-monospace, "SF Mono", monospace; color: #f2f2f5; word-break: break-all; }
  .origin { display: block; padding: 10px 12px; border-radius: 10px; background: rgb(255 255 255 / .06); margin: 12px 0 18px; }
  .row { display: flex; gap: 8px; justify-content: flex-end; }
  button { font: inherit; font-weight: 500; border: 0; border-radius: 999px; padding: 8px 16px; cursor: pointer; color: #f2f2f5; background: rgb(255 255 255 / .08); }
  button.go { background: #0a84ff; color: #fff; }
  small { color: #98989f; }
</style></head><body><main><div class="disc"></div>${body}</main></body></html>`;
}

export function statusPage(info: { folder: string; allowed: string[] }) {
  return page(
    "Curator Helper",
    `<h1>Curator Helper is running</h1>
<p>It saves songs from curator for Ableton. Open curator's <b>Settings → Save for Ableton</b> to connect, then use <b>Save for Ableton</b> on any song.</p>
<p>Songs are saved in <code>${esc(info.folder)}</code>.</p>
${info.allowed.length ? `<p>Connected sites: ${info.allowed.map((o) => `<code>${esc(o)}</code>`).join(", ")}</p>` : ""}
<small>Version ${esc(VERSION)} · it runs in the background with no Dock icon. Quit it from curator's Settings.</small>`,
  );
}

export function allowPage(origin: string, token: string) {
  return page(
    "Allow this site? · Curator Helper",
    `<h1>Let this site send songs?</h1>
<p>It will be able to save songs into your curator folder with Curator Helper.</p>
<span class="origin">${esc(origin)}</span>
<form method="post" action="/allow" class="row">
  <input type="hidden" name="origin" value="${esc(origin)}"><input type="hidden" name="token" value="${esc(token)}">
  <button type="submit" name="answer" value="no">Don't allow</button>
  <button type="submit" name="answer" value="yes" class="go" autofocus>Allow</button>
</form>`,
  );
}

export function donePage(allowed: boolean, origin: string) {
  return page(
    allowed ? "Connected · Curator Helper" : "Not connected · Curator Helper",
    `<h1>${allowed ? "Connected" : "Not connected"}</h1>
<p>${allowed ? `<code>${esc(origin)}</code> can now save songs for Ableton. You can close this tab and go back to curator.` : "Nothing was changed. You can close this tab."}</p>
<script>setTimeout(() => window.close(), 1500)</script>`,
  );
}
