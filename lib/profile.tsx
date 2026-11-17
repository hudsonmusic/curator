"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CrateDef, Marker, SampleType, Track } from "./types";
import { DEFAULT_ACCENT, applyAccent } from "./theme";
import { loadRemote, saveRemote, useAccount, type Account } from "./account";

export interface Reference {
  name: string;
  bpm: number;
  key: string;
  camelot: string;
}

export interface Profile {
  onboarded: boolean;
  scenes: string[];
  types: SampleType[];
  bpmMin: number;
  bpmMax: number;
  projectBpm: number;
  sceneWeights: Record<string, number>;
  artistWeights: Record<string, { w: number; scene?: string }>;
  disliked: string[];
  references: Reference[];
  crateNonce: number;
  /** Your crates: the artists recommendations and random picks come from. */
  crates: CrateDef[];
  /** Crate ids switched on for recommendations. */
  enabled: string[];
  /** Theme accent colour (hex). */
  accent: string;
  /** Show "Send to Downie" for songs (opens the Downie Mac app). */
  downie: boolean;
  /** Ask Downie for audio only. */
  downieAudio: boolean;
}

export interface Saved {
  track: Track;
  savedAt: number;
  note?: string;
}

const DEFAULT: Profile = {
  onboarded: false,
  scenes: [],
  types: ["song", "acapella", "loop"],
  bpmMin: 85,
  bpmMax: 130,
  projectBpm: 124,
  sceneWeights: {},
  artistWeights: {},
  disliked: [],
  references: [],
  crateNonce: 0,
  // You start with no crates; starter scenes are one click away.
  crates: [],
  enabled: [],
  accent: DEFAULT_ACCENT,
  downie: false,
  downieAudio: true,
};

/** One-time clean slate for crates made before accounts existed. */
const WIPE_MARK = "curator:v1:crates-wiped-2026-11";

type Signal = "like" | "pass" | "play" | "mark";
const DELTAS: Record<Signal, { scene: number; artist: number }> = {
  like: { scene: 1, artist: 1 },
  pass: { scene: -0.4, artist: -1 },
  play: { scene: 0.15, artist: 0.2 },
  mark: { scene: 1, artist: 1.5 },
};

interface Ctx {
  ready: boolean;
  profile: Profile;
  saved: Record<string, Saved>;
  markers: Record<string, Marker[]>;
  update: (p: Partial<Profile> | ((prev: Profile) => Partial<Profile>)) => void;
  signal: (kind: Signal, track: Track) => void;
  toggleSave: (track: Track) => void;
  setNote: (id: string, note: string) => void;
  addMarker: (id: string, m: Marker) => void;
  removeMarker: (id: string, t: number) => void;
  reset: () => void;
  likedArtists: { artist: string; scene?: string }[];
  /** Signed-in account, null for guests, undefined while checking. */
  account: Account | null | undefined;
  /** "idle" | "syncing" | "synced" | "error" for the account's cloud copy. */
  sync: SyncState;
}

export type SyncState = "idle" | "syncing" | "synced" | "error";

/** Merge two copies of someone's stuff without losing anything: a's settings win, lists are unioned. */
function merge(a: { profile: Profile; saved: Record<string, Saved>; markers: Record<string, Marker[]> }, b: typeof a): typeof a {
  const ids = new Set(a.profile.crates.map((c) => c.id));
  const markers = { ...b.markers };
  for (const [id, list] of Object.entries(a.markers)) {
    const all = [...(markers[id] ?? []), ...list];
    markers[id] = all.filter((m, i) => all.findIndex((x) => x.t === m.t && x.src === m.src) === i).sort((x, y) => x.t - y.t);
  }
  return {
    profile: {
      ...a.profile,
      crates: [...a.profile.crates, ...b.profile.crates.filter((c) => !ids.has(c.id))],
      enabled: [...new Set([...a.profile.enabled, ...b.profile.enabled])],
      disliked: [...new Set([...a.profile.disliked, ...b.profile.disliked])].slice(-300),
    },
    saved: { ...b.saved, ...a.saved },
    markers,
  };
}

const ProfileCtx = createContext<Ctx | null>(null);
const K = { profile: "curator:v1:profile", saved: "curator:v1:saved", markers: "curator:v1:markers" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(DEFAULT);
  const [saved, setSaved] = useState<Record<string, Saved>>({});
  const [markers, setMarkers] = useState<Record<string, Marker[]>>({});

  useEffect(() => {
    const p = load(K.profile, DEFAULT);
    try {
      if (!localStorage.getItem(WIPE_MARK)) {
        p.crates = [];
        p.enabled = [];
        localStorage.setItem(WIPE_MARK, "1");
      }
    } catch {}
    setProfile(p);
    setSaved(load(K.saved, {}));
    setMarkers(load(K.markers, {}));
    setReady(true);
  }, []);

  useEffect(() => { if (ready) persist(K.profile, profile); }, [ready, profile]);
  useEffect(() => { if (ready) applyAccent(profile.accent); }, [ready, profile.accent]);
  useEffect(() => { if (ready) persist(K.saved, saved); }, [ready, saved]);
  useEffect(() => { if (ready) persist(K.markers, markers); }, [ready, markers]);

  const update = useCallback(
    (p: Partial<Profile> | ((prev: Profile) => Partial<Profile>)) =>
      setProfile((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) })),
    [],
  );

  const signal = useCallback((kind: Signal, track: Track) => {
    const d = DELTAS[kind];
    setProfile((prev) => {
      const sceneWeights = { ...prev.sceneWeights };
      if (track.scene) sceneWeights[track.scene] = (sceneWeights[track.scene] ?? 0) + d.scene;
      const artistWeights = { ...prev.artistWeights };
      const a = artistWeights[track.artist] ?? { w: 0, scene: track.scene };
      artistWeights[track.artist] = { w: a.w + d.artist, scene: a.scene ?? track.scene };
      const disliked =
        kind === "pass" ? [...prev.disliked.filter((x) => x !== track.id), track.id].slice(-300) : prev.disliked;
      return { ...prev, sceneWeights, artistWeights, disliked };
    });
  }, []);

  const savedRef = useRef(saved);
  savedRef.current = saved;
  const toggleSave = useCallback(
    (track: Track) => {
      const wasSaved = !!savedRef.current[track.id];
      setSaved((prev) => {
        const next = { ...prev };
        if (wasSaved) delete next[track.id];
        else next[track.id] = { track, savedAt: Date.now() };
        return next;
      });
      if (!wasSaved) signal("like", track);
    },
    [signal],
  );

  const setNote = useCallback((id: string, note: string) => {
    setSaved((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], note } } : prev));
  }, []);

  const addMarker = useCallback((id: string, m: Marker) => {
    setMarkers((prev) => {
      const list = (prev[id] ?? []).filter((x) => Math.abs(x.t - m.t) > 0.25 || x.src !== m.src);
      return { ...prev, [id]: [...list, m].sort((a, b) => a.t - b.t) };
    });
  }, []);

  const removeMarker = useCallback((id: string, t: number) => {
    setMarkers((prev) => ({ ...prev, [id]: (prev[id] ?? []).filter((x) => x.t !== t) }));
  }, []);

  const reset = useCallback(() => {
    setProfile(DEFAULT);
    setSaved({});
    setMarkers({});
  }, []);

  // Accounts: on sign-in, merge this browser's stuff into the account; then keep it saved there.
  const account = useAccount();
  const [sync, setSync] = useState<SyncState>("idle");
  const syncedFor = useRef<string | null>(null);
  const latest = useRef({ profile, saved, markers });
  latest.current = { profile, saved, markers };
  useEffect(() => {
    if (!ready || account === undefined) return;
    if (!account) {
      // Signed out after being signed in: start this browser fresh as a guest.
      if (syncedFor.current) {
        syncedFor.current = null;
        setProfile((p) => ({ ...DEFAULT, accent: p.accent }));
        setSaved({});
        setMarkers({});
      }
      setSync("idle");
      return;
    }
    if (syncedFor.current === account.id) return;
    let cancelled = false;
    setSync("syncing");
    void (async () => {
      try {
        const remote = await loadRemote(account.id);
        if (cancelled) return;
        const local = latest.current;
        const merged = remote
          ? merge(
              {
                profile: { ...DEFAULT, ...(remote.profile as Partial<Profile>) },
                saved: remote.saved as Record<string, Saved>,
                markers: remote.markers as Record<string, Marker[]>,
              },
              local,
            )
          : local;
        setProfile(merged.profile);
        setSaved(merged.saved);
        setMarkers(merged.markers);
        await saveRemote(account.id, merged as unknown as Parameters<typeof saveRemote>[1]);
        syncedFor.current = account.id;
        if (!cancelled) setSync("synced");
      } catch {
        if (!cancelled) setSync("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, account]);

  // Save changes to the account a moment after they happen.
  useEffect(() => {
    if (!account || syncedFor.current !== account.id) return;
    setSync("syncing");
    const id = setTimeout(() => {
      saveRemote(account.id, { profile, saved, markers } as unknown as Parameters<typeof saveRemote>[1])
        .then(() => setSync("synced"))
        .catch(() => setSync("error"));
    }, 1200);
    return () => clearTimeout(id);
  }, [account, profile, saved, markers]);

  const likedArtists = useMemo(
    () =>
      Object.entries(profile.artistWeights)
        .filter(([, v]) => v.w >= 1)
        .sort((a, b) => b[1].w - a[1].w)
        .slice(0, 30)
        .map(([artist, v]) => ({ artist, scene: v.scene })),
    [profile.artistWeights],
  );

  const value = useMemo(
    () => ({ ready, profile, saved, markers, update, signal, toggleSave, setNote, addMarker, removeMarker, reset, likedArtists, account, sync }),
    [ready, profile, saved, markers, update, signal, toggleSave, setNote, addMarker, removeMarker, reset, likedArtists, account, sync],
  );
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
}

export function useProfile() {
  const c = useContext(ProfileCtx);
  if (!c) throw new Error("useProfile outside provider");
  return c;
}
