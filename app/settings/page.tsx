"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useProfile, type Profile } from "@/lib/profile";
import { accountsEnabled, signIn, signOut, signUp } from "@/lib/account";
import { ACCENTS } from "@/lib/theme";
import { useConfig } from "@/lib/config";
import { refreshScStatus, useScStatus } from "@/lib/soundcloud-client";
import { usePlayer } from "@/components/player";
import { StarterCrates } from "@/components/starter-crates";
import { DownieIcon } from "@/components/open-in";
import { toast } from "@/components/toast";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="fade-up glass rounded-2xl border border-line p-5">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-[12px] text-mute">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, sub, children }: { label: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px]">{label}</div>
        {sub && <div className="text-[12px] text-mute">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => set(!on)}
      className={`relative h-[22px] w-[38px] rounded-full transition-colors duration-200 ${on ? "bg-accent" : "bg-white/[0.14]"}`}
    >
      <span
        className={`absolute top-[2px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.4)] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${on ? "translate-x-[18px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}

function AccountSection() {
  const { account, sync } = useProfile();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!accountsEnabled) {
    return (
      <Section title="Account" hint="You're in guest mode.">
        <p className="text-[13px] text-paper/80">
          Your crates, saves, chop points and settings are kept in this browser until you clear its cookies and site data.
        </p>
        <p className="text-[12px] text-mute">
          Accounts (to keep your stuff across devices) switch on once this site has its Supabase keys. See the README.
        </p>
      </Section>
    );
  }

  if (account) {
    return (
      <Section title="Account" hint="Your stuff is saved to your account and follows you to any device.">
        <Row
          label={account.email ?? "Signed in"}
          sub={sync === "syncing" ? "Saving…" : sync === "error" ? "Couldn't save to your account. Changes are kept here and will retry." : "All changes saved"}
        >
          <button onClick={() => void signOut()} className="btn">
            Sign out
          </button>
        </Row>
      </Section>
    );
  }

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "up") {
        const { needsConfirm } = await signUp(email.trim(), password);
        setMsg(needsConfirm ? "Check your email to confirm, then sign in." : "Account created.");
        if (needsConfirm) setMode("in");
      } else {
        await signIn(email.trim(), password);
        toast("Signed in. Your guest crates and saves were added to your account.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Account"
      hint="You're a guest: everything is kept in this browser until you clear its cookies and site data. Sign in to keep it across devices."
    >
      <div className="flex gap-1 rounded-lg bg-white/[0.06] p-0.5 text-[12px]">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-1 transition-colors ${mode === m ? "bg-white/[0.14] text-paper" : "text-mute hover:text-paper"}`}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-2"
      >
        <input className="field h-9 w-full px-3 text-[13px]" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className="field h-9 w-full px-3 text-[13px]"
          type="password"
          autoComplete={mode === "up" ? "new-password" : "current-password"}
          placeholder={mode === "up" ? "Password (8+ characters)" : "Password"}
          minLength={mode === "up" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex items-center gap-3">
          <button disabled={busy} className="btn btn-on disabled:opacity-50">
            {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
          {msg && <span className="text-[12px] text-mute">{msg}</span>}
        </div>
      </form>
      <p className="text-[12px] text-mute">Signing in adds what you&apos;ve made as a guest to your account.</p>
    </Section>
  );
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Settings() {
  const { ready, profile, update, saved, markers, reset } = useProfile();
  const player = usePlayer();
  const config = useConfig();
  const sc = useScStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const isPreset = ACCENTS.some((a) => a.hex.toLowerCase() === profile.accent.toLowerCase());

  if (!ready) return null;

  return (
    <div className="min-h-dvh pb-32">
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line px-4">
        <Link href="/" className="grid size-8 place-items-center rounded-md text-mute transition-colors hover:bg-white/[0.08] hover:text-paper" aria-label="Back">
          ‹
        </Link>
        <span className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
          <span className="size-3 rounded-full bg-accent" />
          Settings
        </span>
      </header>

      <main className="mx-auto mt-6 max-w-2xl space-y-4 px-4">
        <AccountSection />

        <Section title="Appearance">
          <Row label="Accent colour">
            <div className="flex items-center gap-1.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.hex}
                  onClick={() => update({ accent: a.hex })}
                  title={a.name}
                  aria-label={a.name}
                  className={`size-5 rounded-full transition-transform hover:scale-110 ${profile.accent.toLowerCase() === a.hex.toLowerCase() ? "ring-2 ring-paper ring-offset-2 ring-offset-ink" : ""}`}
                  style={{ background: a.hex }}
                />
              ))}
              <label
                title="Custom colour"
                className={`relative size-5 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] ${!isPreset ? "ring-2 ring-paper ring-offset-2 ring-offset-ink" : ""}`}
              >
                <input type="color" value={profile.accent} onChange={(e) => update({ accent: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
            </div>
          </Row>
        </Section>

        <Section title="Playback">
          <Row label="Full songs" sub={player.fullAvailable ? "Play whole songs from YouTube or SoundCloud instead of 30-second previews" : "Needs a YouTube key or SoundCloud connected"}>
            <Toggle on={player.full} set={player.setFull} label="Full songs" />
          </Row>
          <Row label="Start muted" sub="Mute curator's audio">
            <Toggle on={player.muted} set={player.setMuted} label="Muted" />
          </Row>
          <Row label="Project BPM" sub="What Sync matches songs to in the player">
            <input
              type="number"
              min={60}
              max={200}
              value={profile.projectBpm}
              onChange={(e) => update({ projectBpm: Math.max(60, Math.min(200, Number(e.target.value) || 124)) })}
              className="field h-8 w-20 px-2 text-right font-mono text-[13px]"
            />
          </Row>
        </Section>

        <Section title="Downie" hint="Send songs to the Downie Mac app to download them.">
          <Row label="Send to Downie" sub={<>Adds it to each song&apos;s open-in menu and details, and the D key. Songs go as their YouTube video.</>}>
            <Toggle on={profile.downie} set={(v) => update({ downie: v })} label="Send to Downie" />
          </Row>
          <Row label="Audio only" sub="Ask Downie to save just the audio">
            <Toggle on={profile.downieAudio} set={(v) => update({ downieAudio: v })} label="Audio only" />
          </Row>
          {profile.downie && (
            <p className="flex items-center gap-2 text-[12px] text-mute">
              <DownieIcon />
              Needs Downie installed on this Mac. Your browser asks before opening it the first time.
            </p>
          )}
        </Section>

        <Section title="Connections">
          <Row label="YouTube" sub={config?.youtube ? "Finds full songs to play" : "Add YOUTUBE_API_KEY to play full songs"}>
            <span className={`text-[12px] ${config?.youtube ? "text-accent" : "text-mute"}`}>{config?.youtube ? "On" : "Off"}</span>
          </Row>
          <Row
            label="SoundCloud"
            sub={!sc?.configured ? "Add SoundCloud keys to connect" : sc.connected ? `Connected${sc.user?.username ? ` as ${sc.user.username}` : ""}` : "Your likes and playlists, full-track streaming"}
          >
            {sc?.configured &&
              (sc.connected ? (
                <button
                  onClick={async () => {
                    await fetch("/api/soundcloud/logout", { method: "POST" });
                    refreshScStatus();
                  }}
                  className="btn"
                >
                  Disconnect
                </button>
              ) : (
                <a href="/api/soundcloud/login" className="btn" style={{ background: "#ff5500", color: "#fff" }}>
                  Connect
                </a>
              ))}
          </Row>
        </Section>

        <Section title="Crates" hint={`${profile.crates.length} crate${profile.crates.length === 1 ? "" : "s"}. Edit them from the sidebar.`}>
          <div>
            <div className="mb-2 text-[12px] text-mute">Add a starter crate</div>
            <StarterCrates compact />
          </div>
          <Row label="Delete all crates" sub="Your saved songs and chop points stay">
            <button
              onClick={() => {
                if (confirm(`Delete all ${profile.crates.length} crates? This can't be undone.`)) {
                  update({ crates: [], enabled: [] });
                  toast("All crates deleted.");
                }
              }}
              disabled={!profile.crates.length}
              className="btn text-[#ff6b6b] disabled:opacity-40"
            >
              Delete all
            </button>
          </Row>
        </Section>

        <Section title="Your data">
          <Row label="Export" sub="Crates, saves, chop points and settings as a file">
            <button
              onClick={() => download(`curator-${new Date().toISOString().slice(0, 10)}.json`, { version: 1, profile, saved, markers })}
              className="btn"
            >
              Export
            </button>
          </Row>
          <Row label="Import" sub="Adds crates and saves from an export">
            <button onClick={() => fileRef.current?.click()} className="btn">
              Import…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const d = JSON.parse(await f.text()) as { profile?: Partial<Profile> };
                  const crates = d.profile?.crates ?? [];
                  update((p) => ({
                    crates: [...p.crates, ...crates.filter((c) => !p.crates.some((x) => x.id === c.id))],
                    enabled: [...new Set([...p.enabled, ...(d.profile?.enabled ?? [])])],
                  }));
                  toast(`Imported ${crates.length} crate${crates.length === 1 ? "" : "s"}.`);
                } catch {
                  toast("That file isn't a curator export.");
                }
              }}
            />
          </Row>
          <Row label="Reset everything" sub="Crates, saves, chop points, taste and settings on this browser">
            <button
              onClick={() => {
                if (confirm("Reset everything? This deletes your crates, saves and chop points here and can't be undone.")) {
                  reset();
                  toast("Everything was reset.");
                }
              }}
              className="btn text-[#ff6b6b]"
            >
              Reset
            </button>
          </Row>
        </Section>
      </main>
    </div>
  );
}
