"use client";

import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Optional accounts through Supabase (email + password). Without the two public keys
 * the app runs in guest mode only: everything stays in this browser's storage.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const accountsEnabled = !!(URL && KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!accountsEnabled || typeof window === "undefined") return null;
  client ??= createClient(URL!, KEY!, { auth: { persistSession: true, storageKey: "curator:auth", autoRefreshToken: true } });
  return client;
}

export interface Account {
  id: string;
  email?: string;
}

/** The signed-in account, null for guests, undefined while checking. */
export function useAccount(): Account | null | undefined {
  const [acct, setAcct] = useState<Account | null | undefined>(accountsEnabled ? undefined : null);
  useEffect(() => {
    const sb = supabase();
    if (!sb) return setAcct(null);
    void sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setAcct(u ? { id: u.id, email: u.email } : null);
    });
    const { data } = sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setAcct(u ? { id: u.id, email: u.email } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return acct;
}

export async function signUp(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new Error("Accounts aren't set up on this site.");
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
  if (error) throw error;
  return { needsConfirm: !data.session };
}

export async function signIn(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new Error("Accounts aren't set up on this site.");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase()?.auth.signOut();
}

/** Everything a person keeps in curator, as stored in their account. */
export interface Stored {
  profile: Record<string, unknown>;
  saved: Record<string, unknown>;
  markers: Record<string, unknown>;
}

export async function loadRemote(userId: string): Promise<Stored | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.from("profiles").select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.data as Stored | undefined) ?? null;
}

export async function saveRemote(userId: string, stored: Stored) {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("profiles").upsert({ user_id: userId, data: stored, updated_at: new Date().toISOString() });
  if (error) throw error;
}
