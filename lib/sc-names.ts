/** Uploaders that are labels, premiere channels or blogs rather than the artist. */
const LABELISH = /\b(records?|recordings|rec\b|music|label|premieres?|audio|sounds|collective|radio|tv|magazine|mag|blog|channel|network|promotions?|inc|ltd|llc)\b|records$|recordings$|music$/i;

export const looksLikeLabel = (name: string) => LABELISH.test(name);

const PREMIERE = /^\s*(premiere|exclusive|free download|free dl|out now)\s*[:|-]\s*/i;
const BRACKET_TAIL = /\s*\[[^\]]*\]\s*$/;
const NOISE = /\s*[([]?(free (download|dl)|out now|preview|clip)[)\]]?\s*$/i;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * SoundCloud uploads by labels and premiere channels usually read
 * "PREMIERE: Artist - Track [Label]". Returns the real artist and title when
 * the uploader isn't the artist; otherwise keeps the uploader.
 */
export function splitScTitle(rawTitle: string, uploader: string): { artist: string; title: string } {
  let title = rawTitle;
  const premiere = PREMIERE.test(title);
  title = title.replace(PREMIERE, "").replace(NOISE, "").replace(BRACKET_TAIL, "").replace(NOISE, "").trim();
  const m = title.match(/^(.{2,60}?)\s+[-–—]\s+(.+)$/);
  // The uploader repeating their own name: "Artist - Track".
  if (m && norm(m[1]) === norm(uploader)) return { artist: uploader, title: m[2].trim() };
  if (m && (premiere || looksLikeLabel(uploader))) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: uploader, title: title || rawTitle };
}
