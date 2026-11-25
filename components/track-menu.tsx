"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { usePlayer } from "./player";
import { useSheet } from "./sheet";
import { useRadio } from "./radio";
import { metaOf } from "./meta";
import { openRelated, relatedTo } from "./related";
import { serviceLinks } from "./open-in";
import { saveForAbleton, useAbleton } from "./ableton";
import { sendToDownie } from "./downie";
import { toast } from "./toast";

const EVENT = "curator:track-menu";

interface Req {
  track: Track;
  x: number;
  y: number;
  /** How this list plays a song (keeps its queue); defaults to playing it on its own. */
  play?: () => void;
}

/** Opens the right-click menu for a song at the pointer. Use as an onContextMenu handler. */
export function trackMenu(track: Track, play?: () => void) {
  return (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent<Req>(EVENT, { detail: { track, x: e.clientX, y: e.clientY, play } }));
  };
}

type Item =
  | { kind: "item"; label: string; hint?: string; go: () => void; disabled?: boolean; icon?: ReactNode }
  | { kind: "sep" }
  | { kind: "sub"; label: string; items: Item[] };

/** The one menu, mounted once for the whole app. */
export function TrackMenu() {
  const [req, setReq] = useState<Req | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const player = usePlayer();
  const sheet = useSheet();
  const radio = useRadio();
  const ableton = useAbleton();
  const { profile, saved, toggleSave, signal, update } = useProfile();

  useEffect(() => {
    const open = (e: Event) => {
      setReq((e as CustomEvent<Req>).detail);
      setPos(null);
      setSub(null);
    };
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);

  useEffect(() => {
    if (!req) return;
    const close = (e: Event) => {
      if (e.type === "mousedown" && ref.current?.contains(e.target as Node)) return;
      setReq(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReq(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [req]);

  // Keep the menu on screen: flip left or up when it would run off the edge.
  useLayoutEffect(() => {
    if (!req || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const left = req.x + r.width + 8 > window.innerWidth ? Math.max(8, req.x - r.width) : req.x;
    const top = req.y + r.height + 8 > window.innerHeight ? Math.max(8, req.y - r.height) : req.y;
    setPos({ left, top });
  }, [req]);

  if (!req) return null;
  const t = req.track;
  const m = metaOf(t);
  const isCur = player.track?.id === t.id;
  const close = () => setReq(null);
  const links = serviceLinks(t);
  const copy = (text: string, what: string) =>
    void navigator.clipboard?.writeText(text).then(
      () => toast(`Copied ${what}`),
      () => toast("Couldn't copy"),
    );

  const items: Item[] = [
    {
      kind: "item",
      label: isCur && player.playing ? "Pause" : "Play",
      hint: "Space",
      disabled: !player.canPlay(t),
      go: () => (isCur ? player.toggle() : req.play ? req.play() : player.play(t, undefined, [t])),
    },
    { kind: "item", label: "Details", hint: "↵", go: () => sheet.open(t) },
    { kind: "item", label: "Start radio from this", go: () => radio.start(t) },
    { kind: "sep" },
    ...(t.type === "song"
      ? ([
          { kind: "item", label: "Similar songs", go: () => relatedTo(t, false) },
          { kind: "item", label: profile.mode === "dj" ? "What mixes with this" : "Similar, same key", hint: m.cam, disabled: !m.cam, go: () => relatedTo(t, true) },
        ] as Item[])
      : []),
    { kind: "item", label: `More by ${t.artist}`, go: () => openRelated({ by: "artist", value: t.artist, track: t }) },
    ...(t.label ? ([{ kind: "item", label: `More on ${t.label}`, go: () => openRelated({ by: "label", value: t.label!, track: t }) }] as Item[]) : []),
    ...(m.bpm ? ([{ kind: "item", label: `Songs at ${Math.round(m.bpm)} BPM`, go: () => openRelated({ by: "bpm", value: String(Math.round(m.bpm!)), track: t }) }] as Item[]) : []),
    { kind: "sep" },
    { kind: "item", label: saved[t.id] ? "Unsave" : "Save", hint: "S", go: () => toggleSave(t) },
    ...(ableton.ready ? ([{ kind: "item", label: "Save for Ableton", hint: "A", go: () => void saveForAbleton(t) }] as Item[]) : []),
    ...(profile.downie ? ([{ kind: "item", label: "Send to Downie", hint: "D", go: () => void sendToDownie(t, profile.downieAudio) }] as Item[]) : []),
    ...(profile.crates.length
      ? ([
          {
            kind: "sub",
            label: `Add ${t.artist} to crate`,
            items: profile.crates.map((c) => {
              const has = c.artists.some((a) => a.toLowerCase() === t.artist.toLowerCase());
              return {
                kind: "item",
                label: c.name,
                hint: has ? "✓" : undefined,
                disabled: has,
                go: () => {
                  update((p) => ({ crates: p.crates.map((x) => (x.id === c.id ? { ...x, artists: [...x.artists, t.artist] } : x)) }));
                  toast(`Added ${t.artist} to ${c.name}`);
                },
              };
            }),
          },
        ] as Item[])
      : []),
    { kind: "sep" },
    {
      kind: "sub",
      label: "Open in",
      items: links.map((l) => ({ kind: "item", label: l.label, icon: l.icon, go: () => window.open(l.href, "_blank", "noopener") })),
    },
    { kind: "item", label: "Copy artist and title", go: () => copy(`${t.artist} - ${t.title}`, "artist and title") },
    ...(t.pageUrl ? ([{ kind: "item", label: "Copy link", go: () => copy(t.pageUrl!, "link") }] as Item[]) : []),
    { kind: "sep" },
    {
      kind: "item",
      label: "Not for me",
      go: () => {
        signal("pass", t);
        toast("Hidden. You'll hear less like it.");
      },
    },
  ];

  const row = (it: Item, i: number, inSub = false): ReactNode => {
    if (it.kind === "sep") return <div key={i} className="mx-2 my-1 border-t border-line" />;
    if (it.kind === "sub") {
      const open = sub === it.label;
      return (
        <div key={i} className="relative" onMouseEnter={() => setSub(it.label)}>
          <button
            onClick={() => setSub(open ? null : it.label)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] ${open ? "bg-white/[0.1]" : "hover:bg-white/[0.1]"}`}
          >
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <span className="text-mute">›</span>
          </button>
          {open && (
            <div
              className={`glass-strong !bg-menu absolute top-0 z-10 max-h-[60vh] w-52 overflow-y-auto rounded-xl border border-white/[0.1] p-1 shadow-[0_16px_40px_rgb(0_0_0/0.55)] ${
                pos && pos.left + 230 + 210 > window.innerWidth ? "right-full mr-1" : "left-full ml-1"
              }`}
            >
              {it.items.map((x, j) => row(x, j, true))}
            </div>
          )}
        </div>
      );
    }
    return (
      <button
        key={i}
        disabled={it.disabled}
        onMouseEnter={() => !inSub && setSub(null)}
        onClick={() => {
          close();
          it.go();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors enabled:hover:bg-accent enabled:hover:text-onaccent disabled:opacity-40"
      >
        {it.icon}
        <span className="min-w-0 flex-1 truncate">{it.label}</span>
        {it.hint && <span className="shrink-0 font-mono text-[10px] opacity-60">{it.hint}</span>}
      </button>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        role="menu"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: pos ? 1 : 0, scale: 1 }}
        transition={{ duration: 0.12 }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: "fixed", left: pos?.left ?? req.x, top: pos?.top ?? req.y }}
        className="glass-strong !bg-menu z-[70] w-[230px] rounded-xl border border-white/[0.1] p-1 shadow-[0_16px_40px_rgb(0_0_0/0.55)]"
      >
        <div className="truncate px-2 pb-1 pt-1 text-[11px] text-mute">
          {t.artist} · {t.title}
        </div>
        {items.map((it, i) => row(it, i))}
      </motion.div>
    </AnimatePresence>
  );
}
