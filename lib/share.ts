"use client";

import type { CrateDef } from "./types";
import { supabase } from "./account";
import { SCENE_BY_ID } from "./scenes";

/** Crates shared by link. Anyone can open one; only the person who shared it can change it. */

function newId() {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => a[b % a.length]).join("");
}

export function shareUrl(id: string) {
  return `${location.origin}/c/${id}`;
}

/** What's stored: the crate without your own bookkeeping. */
function publicCrate(c: CrateDef) {
  // Starter crates are named after a scene, which also brings in deep cuts.
  return { name: c.name, artists: c.artists, years: c.years, scene: SCENE_BY_ID[c.id] ? c.id : undefined };
}

/** Shares (or re-shares) a crate; returns its link id. */
export async function shareCrate(crate: CrateDef): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("Sharing needs accounts set up on this site.");
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error("Sign in (in Settings) to share crates.");
  const id = crate.shareId ?? newId();
  const { error } = await sb
    .from("shared_crates")
    .upsert({ id, owner: data.session.user.id, crate: publicCrate(crate), updated_at: new Date().toISOString() });
  if (error) throw error;
  return id;
}

/** Keeps a shared copy in step with your edits. */
export async function updateShared(crate: CrateDef) {
  const sb = supabase();
  if (!sb || !crate.shareId) return;
  await sb.from("shared_crates").update({ crate: publicCrate(crate), updated_at: new Date().toISOString() }).eq("id", crate.shareId);
}

export async function unshareCrate(id: string) {
  await supabase()?.from("shared_crates").delete().eq("id", id);
}

export interface SharedCrate {
  id: string;
  crate: { name: string; artists: string[]; years?: [number, number]; scene?: string };
  updated_at: string;
}

export async function loadShared(id: string): Promise<SharedCrate | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.from("shared_crates").select("id, crate, updated_at").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as SharedCrate | null) ?? null;
}
