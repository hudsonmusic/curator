/** Recognising YouTube and SoundCloud links, and reading song details out of video titles. */

function toUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

const VIDEO_ID = /^[\w-]{11}$/;

/** The video id of any kind of YouTube link: watch, youtu.be, music, shorts, embed, live. */
export function youtubeIdOf(raw: string): string | null {
  const u = toUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = parts[0] === "watch" ? u.searchParams.get("v") : ["shorts", "embed", "live", "v"].includes(parts[0]) ? parts[1] ?? null : null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** A clean https link to a SoundCloud track or playlist (short on.soundcloud.com links included). */
export function soundcloudUrlOf(raw: string): string | null {
  const u = toUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  if (host === "on.soundcloud.com") return parts.length === 1 ? `https://on.soundcloud.com/${parts[0]}` : null;
  if (host !== "soundcloud.com" || parts.length < 2) return null;
  return `https://soundcloud.com/${parts.join("/")}`;
}

export const isMusicLink = (raw: string) => !!youtubeIdOf(raw) || !!soundcloudUrlOf(raw);

const NOISE =
  /\s*[([][^)\]]*\b(official|lyrics?|audio|video|visuali[sz]er|hd|hq|4k|remaster(ed)?|full (song|album)|free download|out now)\b[^)\]]*[)\]]/gi;

/** "Artist - Song (Official Video)" → artist and title. Falls back to the channel name. */
export function parseVideoTitle(rawTitle: string, channel: string): { artist: string; title: string } {
  const uploader = channel.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").replace(/\s+Official$/i, "").trim() || "Unknown artist";
  const clean = rawTitle.replace(NOISE, "").replace(/\s{2,}/g, " ").trim() || rawTitle;
  const m = clean.match(/^(.{1,80}?)\s+[-–—|]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: uploader, title: clean };
}
