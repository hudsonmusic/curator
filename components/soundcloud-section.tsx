"use client";

import { useEffect, useState } from "react";
import { refreshScStatus, useScStatus } from "@/lib/soundcloud-client";
import type { View } from "./crates-panel";

interface Playlist {
  id: string;
  title: string;
  count: number;
}

const row = (on: boolean) =>
  `flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[13px] transition-colors duration-150 ${
    on ? "bg-white/[0.1] text-paper" : "text-paper/75 hover:bg-white/[0.05] hover:text-paper"
  }`;

export function SoundCloudSection({ view, setView }: { view: View; setView: (v: View) => void }) {
  const sc = useScStatus();
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!sc?.connected) return;
    fetch("/api/soundcloud/playlists")
      .then((r) => (r.ok ? r.json() : { playlists: [] }))
      .then((d: { playlists: Playlist[] }) => setPlaylists(d.playlists))
      .catch(() => setPlaylists([]));
  }, [sc?.connected]);

  if (!sc) return null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-semibold text-mute">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 hover:text-paper">
          <span className={`inline-block transition-transform duration-200 ${open ? "rotate-90" : ""}`}>›</span> SoundCloud
        </button>
        {sc.connected && (
          <button
            onClick={async () => {
              await fetch("/api/soundcloud/logout", { method: "POST" });
              setPlaylists(null);
              await refreshScStatus();
              if (view.kind === "sc") setView({ kind: "crates" });
            }}
            className="font-normal hover:text-paper"
          >
            Disconnect
          </button>
        )}
      </div>
      {open &&
        (!sc.configured ? (
          <p className="px-2 text-[12px] leading-snug text-mute">
            Add <span className="font-mono text-[11px]">SOUNDCLOUD_CLIENT_ID</span> and <span className="font-mono text-[11px]">SECRET</span> to connect your likes and playlists.
          </p>
        ) : !sc.connected ? (
          <a href="/api/soundcloud/login" className="btn mx-2 w-[calc(100%-1rem)] bg-[#ff5500]/90 text-white hover:bg-[#ff5500]">
            Connect SoundCloud
          </a>
        ) : (
          <div>
            <div className="mb-1 truncate px-2 text-[11px] text-mute">as {sc.user?.username}</div>
            <button onClick={() => setView({ kind: "sc", id: "likes", name: "Likes" })} className={row(view.kind === "sc" && view.id === "likes")}>
              <span className="text-[#ff5500]">♥</span>
              <span className="flex-1">Likes</span>
            </button>
            {playlists === null ? (
              <div className="px-2 py-1 text-[12px] text-mute">Loading playlists…</div>
            ) : (
              playlists.map((p) => (
                <button key={p.id} onClick={() => setView({ kind: "sc", id: p.id, name: p.title })} className={row(view.kind === "sc" && view.id === p.id)}>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="text-[11px] text-mute">{p.count}</span>
                </button>
              ))
            )}
          </div>
        ))}
    </div>
  );
}
