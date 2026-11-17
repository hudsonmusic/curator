"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useProfile } from "@/lib/profile";
import { iconDataUrl } from "@/lib/icon";
import { usePlayer } from "./player";

/** Keeps the browser tab in step: the song in the title, the icon in your accent colour. */
export function LiveTab() {
  const { track, playing } = usePlayer();
  const { ready, profile } = useProfile();
  const path = usePathname();

  useEffect(() => {
    if (!track) return; // pages keep their own titles when nothing is playing
    const title = `${playing ? "▶ " : ""}${track.title} · ${track.artist}`;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    // Next.js re-applies the page's own title now and then (navigating, refreshing);
    // put the song back whenever that happens.
    const obs = new MutationObserver(apply);
    obs.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [track, playing]);

  useEffect(() => {
    if (track) return;
    document.title = path === "/settings" ? "Settings · curator" : path.startsWith("/c/") ? document.title : "curator";
  }, [track, path]);

  useEffect(() => {
    if (!ready) return;
    const href = iconDataUrl(profile.accent);
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    if (!links.length) {
      const l = document.createElement("link");
      l.rel = "icon";
      document.head.appendChild(l);
      links.push(l);
    }
    for (const l of links) {
      l.type = "image/svg+xml";
      l.href = href;
    }
  }, [ready, profile.accent, path]);

  return null;
}
