"use client";

import type { Track } from "@/lib/types";
import { findVideo } from "./youtube";
import { toast } from "./toast";

/**
 * Hands a song to the Downie Mac app through its URL scheme
 * (downie://XUOpenLink?url=…). Songs go as their YouTube video; SoundCloud
 * tracks go as their SoundCloud page. The browser asks before opening Downie
 * the first time.
 */
export async function sendToDownie(t: Track, audioOnly: boolean) {
  let url: string | null = null;
  if (t.source === "soundcloud") url = t.pageUrl;
  else if (t.type === "song") {
    toast(`Finding “${t.title}” on YouTube…`);
    const id = await findVideo(t);
    if (id) url = `https://www.youtube.com/watch?v=${id}`;
  } else if (t.pageUrl) url = t.pageUrl;
  if (!url) {
    toast("Couldn't find a video for this one.");
    return false;
  }
  const a = document.createElement("a");
  a.href = `downie://XUOpenLink?url=${encodeURIComponent(url)}${audioOnly ? "&postprocessing=audio" : ""}`;
  a.click();
  toast(`Sent “${t.title}” to Downie${audioOnly ? " (audio)" : ""}`);
  return true;
}
