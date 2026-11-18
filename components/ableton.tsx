"use client";

import type { Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { waitForAnalysis } from "@/lib/analysis-store";
import { clearHelperJob, helperPaired, linkModeNeeded, markHelperJobPending, revealJob, sendToHelperLink, saveToHelper, useHelper, useHelperJob } from "@/lib/helper";
import { fullVersion, scConnected } from "@/lib/soundcloud-client";
import { findVideo, knownVideo, videoLookupUrl } from "./youtube";
import { metaOf } from "./meta";
import { toast } from "./toast";

/** Whether "Save for Ableton" is switched on and the helper is running and connected. */
export function useAbleton() {
  const { profile } = useProfile();
  const status = useHelper(profile.helper);
  // Safari can't reach the helper directly; it hands songs over with a link instead.
  const link = profile.helper && !status?.paired && linkModeNeeded();
  return { on: profile.helper, ready: profile.helper && (!!status?.paired || link), link, status };
}

/** The best full-length source: SoundCloud uploads (acapellas) as they are; songs by their YouTube video, else SoundCloud. */
async function sourceFor(t: Track): Promise<string | null> {
  if (t.source === "soundcloud") return t.pageUrl;
  if (t.youtubeId) return t.pageUrl;
  if (t.type === "song") {
    const id = await findVideo(t);
    if (id) return `https://www.youtube.com/watch?v=${id}`;
    if (scConnected()) {
      const sc = await fullVersion(t);
      if (sc?.pageUrl) return sc.pageUrl;
    }
  }
  return null;
}

/**
 * Safari: the curator-helper:// link has to open right away (straight from the click),
 * so no waiting for lookups. A song's video goes along if it's known; otherwise the
 * helper asks this site which video it is.
 */
function sendByLink(t: Track) {
  const m = metaOf(t);
  const id = knownVideo(t);
  let url: string | undefined;
  let resolve: string | undefined;
  if (t.source === "soundcloud") url = t.pageUrl;
  else if (id) url = `https://www.youtube.com/watch?v=${id}`;
  else if (t.type === "song") resolve = videoLookupUrl(t);
  if (!url && !resolve) {
    toast(`Couldn't find a full version of “${t.title}” to save.`);
    return;
  }
  sendToHelperLink(t, url ?? "", { title: t.title, artist: t.artist, year: t.year, label: t.label, genre: m.genre, bpm: m.bpm, key: m.key, camelot: m.cam, artwork: t.artwork, source: url ?? t.pageUrl }, resolve);
  toast(`Sent “${t.title}” to Curator Helper. It'll notify you when it's saved.`);
}

export async function saveForAbleton(t: Track, link = linkModeNeeded() && !helperPaired()) {
  if (link) return sendByLink(t);
  markHelperJobPending(t.id, `${t.artist} – ${t.title}`);
  const url = await sourceFor(t);
  if (!url) {
    clearHelperJob(t.id);
    toast(`Couldn't find a full version of “${t.title}” to save.`);
    return;
  }
  toast(`Saving “${t.title}” for Ableton…`);
  // BPM and key go in the file name and tags, so let the analysis finish first.
  await waitForAnalysis(t);
  const m = metaOf(t);
  const meta = {
    title: t.title,
    artist: t.artist,
    year: t.year,
    label: t.label,
    genre: m.genre,
    bpm: m.bpm,
    key: m.key,
    camelot: m.cam,
    artwork: t.artwork,
    source: url,
  };
  const job = await saveToHelper(t, url, meta);
  if (job.state === "done") toast(`Saved “${t.title}” to your curator folder`);
  else toast(job.error ?? "Couldn't save that one.");
}

export function AbletonIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.5v7M4.8 6.6L8 9.8l3.2-3.2M3 12.5h10" />
    </svg>
  );
}

/** "Save for Ableton" → progress → "Show in Finder". */
export function AbletonButton({ track, className = "btn rounded-full px-3 py-1.5" }: { track: Track; className?: string }) {
  const { ready } = useAbleton();
  const job = useHelperJob(track.id);
  if (!ready || (track.type !== "song" && track.source !== "soundcloud" && !track.youtubeId)) return null;

  if (job?.sent) {
    return (
      <button
        onClick={() => clearHelperJob(track.id)}
        className={`${className} text-accent`}
        title="Handed to Curator Helper; it shows a notification when the file is saved. Click to send again."
      >
        <AbletonIcon />
        Sent to helper
      </button>
    );
  }
  if (job?.state === "done") {
    return (
      <button
        onClick={() => void revealJob(job.id).catch(() => toast("The helper isn't running."))}
        onDoubleClick={() => clearHelperJob(track.id)}
        className={`${className} text-accent`}
        title={job.file ? `${job.file}\nDrag it from Finder (or Ableton's Places) into your set.` : undefined}
      >
        <AbletonIcon />
        Show in Finder
      </button>
    );
  }
  const working = job && job.state !== "error";
  return (
    <button
      onClick={() => !working && void saveForAbleton(track)}
      disabled={!!working}
      className={`${className} relative overflow-hidden`}
      title="Download it, tagged with BPM, key, label and cover, into your curator folder"
    >
      {working && <span className="absolute inset-y-0 left-0 bg-accent/30 transition-[width] duration-500" style={{ width: `${Math.max(6, job.progress * 100)}%` }} />}
      <span className="relative inline-flex items-center gap-1.5">
        <AbletonIcon />
        {working ? (job.state === "converting" ? "Tagging…" : job.state === "queued" ? "Waiting…" : `${Math.round(job.progress * 100)}%`) : job?.state === "error" ? "Try again" : "Save for Ableton"}
      </span>
    </button>
  );
}
