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
    const page = path === "/settings" ? "Settings · curator" : "curator";
    const title = track ? `${playing ? "▶ " : ""}${track.title} · ${track.artist}` : page;
    document.title = title;
    // Next.js sets the page's own title after navigating; put the song back on top.
    const id = setTimeout(() => (document.title = title), 120);
    return () => clearTimeout(id);
  }, [track, playing, path]);

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
