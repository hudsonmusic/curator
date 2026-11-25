"use client";

import type { Track } from "./types";

/**
 * The audio of a track as bytes the browser can decode: the file itself for previews,
 * or, for SoundCloud, the first stretch of its stream (HLS chunks of MP3, joined).
 */
export async function fetchAudio(t: Track, seconds = 60): Promise<ArrayBuffer> {
  if (!t.audioUrl) throw new Error("no audio");
  if (!t.audioUrl.startsWith("/api/soundcloud/stream/")) {
    const res = await fetch(t.audioUrl);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return res.arrayBuffer();
  }
  const r = await fetch(`${t.audioUrl}?resolve=1`);
  if (!r.ok) throw new Error(`resolve ${r.status}`);
  const { url, hls } = (await r.json()) as { url: string; hls: boolean };
  if (!hls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return res.arrayBuffer();
  }
  const playlist = await (await fetch(url)).text();
  const parts: string[] = [];
  let dur = 0;
  // Skip the first few seconds of intro when there's room, like a preview would.
  for (const line of playlist.split("\n")) {
    const l = line.trim();
    const m = l.match(/^#EXTINF:([\d.]+)/);
    if (m) dur += Number(m[1]);
    else if (l && !l.startsWith("#")) {
      parts.push(new URL(l, url).href);
      if (dur >= seconds) break;
    }
  }
  if (/\.(m4s|mp4|ts)(\?|$)/.test(parts[0] ?? "")) throw new Error("not mp3 chunks");
  const chunks = await Promise.all(parts.map((p) => fetch(p).then((x) => (x.ok ? x.arrayBuffer() : Promise.reject(new Error(`chunk ${x.status}`))))));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(new Uint8Array(c), at);
    at += c.byteLength;
  }
  return out.buffer;
}
